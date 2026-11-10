/**
 * Client-side MP4 export of a luminar.
 *
 * Scenes are animated SVGs (CSS @keyframes, sometimes SMIL) + one narration
 * MP3 each. Neither can be drawn into a canvas mid-animation directly, so for
 * every frame we:
 *   1. keep a *live* copy of the scene SVG mounted offscreen with all its
 *      animations paused,
 *   2. seek those animations to the frame's time (Web Animations API for CSS,
 *      setCurrentTime() for SMIL),
 *   3. bake each animated property's current computed value into a static
 *      clone, serialize it, decode it as an image and draw it (plus captions)
 *      onto a 1280×720 canvas,
 *   4. hand the canvas to WebCodecs via Mediabunny, which muxes an MP4 with the
 *      narration track.
 * Nothing leaves the browser and no server rendering is needed.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from "mediabunny"
import type { CaptionSegment, Scene } from "./schemas"
import { sanitizeSvg } from "./svg"
import { exportSupported } from "./exportSupport"

const WIDTH = 1280
const HEIGHT = 720
const SAMPLE_RATE = 48000
const DEFAULT_SCENE_MS = 5000
const SMIL_SELECTOR = "animate, animateTransform, animateColor, animateMotion, set"
const SVG_NS = "http://www.w3.org/2000/svg"

export class ExportUnsupportedError extends Error {
  name = "ExportUnsupportedError"
}

export interface ExportProgress {
  phase: "preparing" | "rendering" | "finishing"
  done: number
  total: number
}

export interface ExportResult {
  blob: Blob
  /** Things that didn't make it into the file (shown to the user). */
  warnings: string[]
}

export interface ExportOptions {
  fps?: number
  captions?: boolean
  signal?: AbortSignal
  onProgress?: (p: ExportProgress) => void
}


function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError")
}

const kebab = (prop: string) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const KEYFRAME_META = new Set(["offset", "computedOffset", "easing", "composite"])

// ---------------------------------------------------------------------------
// One scene's frames
// ---------------------------------------------------------------------------

interface CssBake {
  index: number
  props: string[]
}

interface SmilBake {
  index: number
  attr: string
  transform: boolean
}

class SceneFrames {
  private host: HTMLDivElement | null = null
  private live: SVGSVGElement | null = null
  private elements: Element[] = []
  private animations: Animation[] = []
  private css: CssBake[] = []
  private smil: SmilBake[] = []
  private staticImage: HTMLImageElement | null = null

  static async create(rawSvg: string | null): Promise<SceneFrames> {
    const frames = new SceneFrames()
    if (rawSvg) await frames.mount(rawSvg)
    return frames
  }

  get hasVisual() {
    return !!this.live
  }

  private async mount(rawSvg: string) {
    const doc = new DOMParser().parseFromString(sanitizeSvg(rawSvg), "image/svg+xml")
    const root = doc.documentElement
    if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return

    // Rendered (not display:none — hidden elements run no CSS animations) but offscreen.
    this.host = document.createElement("div")
    this.host.setAttribute("aria-hidden", "true")
    this.host.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:450px;pointer-events:none;"
    const live = document.importNode(root, true) as unknown as SVGSVGElement
    live.setAttribute("width", "800")
    live.setAttribute("height", "450")
    if (!live.getAttribute("viewBox")) live.setAttribute("viewBox", "0 0 800 450")
    this.host.appendChild(live)
    document.body.appendChild(this.host)
    this.live = live
    void live.getBoundingClientRect() // flush styles so CSS animations exist

    this.elements = [live, ...Array.from(live.querySelectorAll("*"))]
    const indexOf = new Map(this.elements.map((el, i) => [el, i]))

    // CSS animations: pause, and remember which properties each element animates.
    const byIndex = new Map<number, Set<string>>()
    for (const anim of live.getAnimations({ subtree: true })) {
      const effect = anim.effect as KeyframeEffect | null
      const target = effect?.target
      const index = target instanceof Element ? indexOf.get(target) : undefined
      if (!effect || index === undefined) continue
      anim.pause()
      this.animations.push(anim)
      const props = byIndex.get(index) ?? new Set<string>()
      for (const kf of effect.getKeyframes()) {
        for (const key of Object.keys(kf)) if (!KEYFRAME_META.has(key)) props.add(kebab(key))
      }
      if (props.has("transform")) {
        props.add("transform-origin")
        props.add("transform-box")
      }
      byIndex.set(index, props)
    }
    this.css = [...byIndex].map(([index, props]) => ({ index, props: [...props] }))

    // SMIL: pause the document timeline, remember animated attributes.
    const smilEls = Array.from(live.querySelectorAll(SMIL_SELECTOR)) as SVGAnimationElement[]
    if (smilEls.length) {
      live.pauseAnimations()
      for (const el of smilEls) {
        const target = el.targetElement
        const index = target ? indexOf.get(target) : undefined
        if (index === undefined || el.localName === "animateMotion") continue
        const transform = el.localName === "animateTransform"
        const attr = transform ? "transform" : el.getAttribute("attributeName") ?? ""
        if (attr) this.smil.push({ index, attr, transform })
      }
    }
  }

  /** The scene's visual at `ms` into the scene, as a drawable image. */
  async frameAt(ms: number): Promise<HTMLImageElement | null> {
    if (!this.live) return null
    const animated = this.animations.length > 0 || this.smil.length > 0
    if (!animated && this.staticImage) return this.staticImage

    for (const anim of this.animations) anim.currentTime = ms
    if (this.smil.length) this.live.setCurrentTime(ms / 1000)

    const clone = this.live.cloneNode(true) as SVGSVGElement
    const cloneEls = [clone, ...Array.from(clone.querySelectorAll("*"))]

    for (const { index, props } of this.css) {
      const computed = getComputedStyle(this.elements[index])
      const target = cloneEls[index] as SVGElement
      for (const prop of props) {
        const value = computed.getPropertyValue(prop)
        if (value) target.style.setProperty(prop, value, "important")
      }
    }
    for (const { index, attr, transform } of this.smil) {
      try {
        this.bakeSmil(this.elements[index] as SVGGraphicsElement, cloneEls[index] as SVGElement, attr, transform)
      } catch {
        /* leave this attribute at its base value */
      }
    }
    clone.querySelectorAll(SMIL_SELECTOR).forEach((n) => n.remove())
    const freeze = document.createElementNS(SVG_NS, "style")
    freeze.textContent = "*{animation:none!important;transition:none!important}"
    clone.appendChild(freeze)
    clone.setAttribute("width", String(WIDTH))
    clone.setAttribute("height", String(HEIGHT))

    const image = await svgToImage(new XMLSerializer().serializeToString(clone))
    if (!animated) this.staticImage = image
    return image
  }

  private bakeSmil(live: SVGGraphicsElement, clone: SVGElement, attr: string, transform: boolean) {
    if (transform) {
      const m = live.transform?.animVal.consolidate()?.matrix
      if (m) clone.setAttribute("transform", `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`)
      return
    }
    const animated = (live as unknown as Record<string, { animVal?: unknown }>)[attr]
    const val = animated?.animVal
    if (typeof val === "number" || typeof val === "string") {
      clone.setAttribute(attr, String(val))
    } else if (val && typeof val === "object" && "valueAsString" in val) {
      clone.setAttribute(attr, String((val as SVGLength).valueAsString))
    } else {
      // Presentation attributes (opacity, fill, …) show up in computed style.
      const v = getComputedStyle(live).getPropertyValue(attr)
      if (v) clone.style.setProperty(attr, v, "important")
    }
  }

  dispose() {
    this.host?.remove()
    this.host = null
    this.live = null
  }
}

async function svgToImage(markup: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    // The decoded bitmap stays usable after the URL is revoked.
    URL.revokeObjectURL(url)
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawPlaceholder(ctx: CanvasRenderingContext2D, title: string) {
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  g.addColorStop(0, "#e0e7ff")
  g.addColorStop(1, "#f5f3ff")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = "#334155"
  ctx.font = "600 44px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2, WIDTH - 160)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(-2) // at most two lines, like the player overlay
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = "500 30px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const lines = wrapLines(ctx, text, WIDTH - 240)
  const lineH = 40
  const boxW = Math.min(WIDTH - 160, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48)
  const boxH = lines.length * lineH + 24
  const x = (WIDTH - boxW) / 2
  const y = HEIGHT - boxH - 36
  ctx.fillStyle = "rgba(0,0,0,0.72)"
  ctx.beginPath()
  ctx.roundRect(x, y, boxW, boxH, 14)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  lines.forEach((l, i) => ctx.fillText(l, WIDTH / 2, y + 12 + lineH * i + lineH / 2))
}

function captionAt(segments: CaptionSegment[] | null | undefined, ms: number): string | null {
  return segments?.find((c) => ms >= c.start_ms && ms < c.end_ms)?.text ?? null
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

async function fetchText(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(url, { signal })
    return r.ok ? await r.text() : null
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e
    return null
  }
}

async function decodeAudio(url: string, decoder: BaseAudioContext, signal?: AbortSignal): Promise<AudioBuffer | null> {
  try {
    const r = await fetch(url, { signal })
    if (!r.ok) return null
    return await decoder.decodeAudioData(await r.arrayBuffer())
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e
    return null
  }
}

export async function exportLuminarMp4(scenes: Scene[], opts: ExportOptions = {}): Promise<ExportResult> {
  const { fps = 15, captions = true, signal, onProgress } = opts
  if (!exportSupported()) throw new ExportUnsupportedError("This browser can't encode video. Try a recent Chrome, Edge or Safari.")
  const videoCodec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: WIDTH, height: HEIGHT })
  if (!videoCodec) throw new ExportUnsupportedError("This browser can't encode MP4 video. Try a recent Chrome, Edge or Safari.")

  const ordered = [...scenes].sort((a, b) => a.scene_index - b.scene_index)
  onProgress?.({ phase: "preparing", done: 0, total: ordered.length })

  // 1. Narration: decode every scene's audio; a scene lasts as long as its audio.
  const decoder = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const audio: (AudioBuffer | null)[] = []
  const svgs: (string | null)[] = []
  for (const [i, s] of ordered.entries()) {
    checkAbort(signal)
    audio.push(s.audio_url ? await decodeAudio(s.audio_url, decoder, signal) : null)
    svgs.push(s.svg_url ? await fetchText(s.svg_url, signal) : null)
    onProgress?.({ phase: "preparing", done: i + 1, total: ordered.length })
  }
  const plural = (n: number, word: string) => `${n} scene${n === 1 ? "" : "s"} ${word}`
  const warnings: string[] = []
  const lostAudio = ordered.filter((s, i) => s.audio_url && !audio[i]).length
  const lostVisual = ordered.filter((s, i) => s.svg_url && !svgs[i]).length
  if (lostAudio) warnings.push(`${plural(lostAudio, lostAudio === 1 ? "lost its narration" : "lost their narration")} (couldn't load the audio)`)
  if (lostVisual) warnings.push(`${plural(lostVisual, "used a placeholder")} (couldn't load the visual)`)

  const durations = ordered.map((s, i) => (audio[i] ? audio[i]!.duration * 1000 : s.duration_ms || DEFAULT_SCENE_MS))
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0))
  const totalMs = durations.reduce((a, b) => a + b, 0)

  let mixed: AudioBuffer | null = null
  if (audio.some(Boolean)) {
    const mixer = new OfflineAudioContext(1, Math.ceil((totalMs / 1000) * SAMPLE_RATE), SAMPLE_RATE)
    audio.forEach((buf, i) => {
      if (!buf) return
      const src = mixer.createBufferSource()
      src.buffer = buf
      src.connect(mixer.destination)
      src.start(starts[i] / 1000)
    })
    mixed = await mixer.startRendering()
  }
  const audioCodec = mixed
    ? await getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 1, sampleRate: SAMPLE_RATE })
    : null
  if (mixed && !audioCodec) warnings.push("This browser can't encode audio, so the video is silent")

  // 2. Muxer + encoders.
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext("2d")!
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() })
  const videoSource = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 })
  output.addVideoTrack(videoSource, { frameRate: fps })
  const audioSource = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_MEDIUM }) : null
  if (audioSource) output.addAudioTrack(audioSource)

  const frameCounts = durations.map((d) => Math.max(1, Math.round((d / 1000) * fps)))
  const totalFrames = frameCounts.reduce((a, b) => a + b, 0)
  let done = 0

  try {
    await output.start()
    if (audioSource && mixed) await audioSource.add(mixed)

    // 3. Frames, scene by scene.
    for (const [i, scene] of ordered.entries()) {
      const frames = await SceneFrames.create(svgs[i])
      try {
        for (let f = 0; f < frameCounts[i]; f++) {
          checkAbort(signal)
          const ms = (f / fps) * 1000
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, WIDTH, HEIGHT)
          const img = frames.hasVisual ? await frames.frameAt(ms) : null
          if (img) ctx.drawImage(img, 0, 0, WIDTH, HEIGHT)
          else drawPlaceholder(ctx, scene.title ?? `Scene ${i + 1}`)
          if (captions) {
            const text = captionAt(scene.caption_segments, ms)
            if (text) drawCaption(ctx, text)
          }
          await videoSource.add(starts[i] / 1000 + f / fps, 1 / fps)
          done++
          if (done % 5 === 0 || done === totalFrames) onProgress?.({ phase: "rendering", done, total: totalFrames })
        }
      } finally {
        frames.dispose()
      }
    }

    onProgress?.({ phase: "finishing", done: totalFrames, total: totalFrames })
    await output.finalize()
  } catch (e) {
    await output.cancel().catch(() => {})
    throw e
  }

  const buffer = (output.target as BufferTarget).buffer
  if (!buffer) throw new Error("The video encoder produced no output")
  return { blob: new Blob([buffer], { type: "video/mp4" }), warnings }
}
