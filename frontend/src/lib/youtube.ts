import { useEffect, useRef, useState } from "react"

const YT_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/

/** Mirrors backend data_extractor.youtube_video_id. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  const m = url ? YT_ID_RE.exec(url) : null
  return m ? m[1] : null
}

export function formatTime(totalSeconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** Parse "m:ss", "h:mm:ss" or plain seconds. Returns null when invalid. */
export function parseTime(input: string): number | null {
  const parts = input.trim().split(":")
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0)
}

// --- Minimal YouTube IFrame API typing (only what we use) -------------------

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  destroy(): void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string
      height?: string
      playerVars?: Record<string, number | string>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
        onError?: (e: { data: number }) => void
      }
    }
  ) => YTPlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error("Could not load the YouTube player"))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

/**
 * Mount a YouTube player into the returned ref's element and report the
 * current time (polled every 250ms while mounted).
 */
export function useYouTubePlayer(videoId: string | null, onEnded?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [player, setPlayer] = useState<YTPlayer | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const onEndedRef = useRef(onEnded)

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    if (!videoId || !containerRef.current) return
    let cancelled = false
    let instance: YTPlayer | null = null
    // The API replaces the target element with an iframe, so give it a child.
    const mount = document.createElement("div")
    containerRef.current.appendChild(mount)

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        instance = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (e) => {
              if (cancelled) return
              setPlayer(e.target)
              setDuration(e.target.getDuration())
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED) onEndedRef.current?.()
            },
            // 2 bad id · 5 HTML5 error · 100 removed/private · 101/150 embedding disabled
            onError: (e) => {
              if (cancelled) return
              setError(
                e.data === 101 || e.data === 150
                  ? "The owner of this video doesn't allow it to be played here."
                  : e.data === 100
                    ? "This video was removed or is private."
                    : "This video couldn't be played."
              )
            },
          },
        })
      })
      .catch((e: Error) => !cancelled && setError(e.message))

    return () => {
      cancelled = true
      instance?.destroy()
      mount.remove()
      setPlayer(null)
    }
  }, [videoId])

  useEffect(() => {
    if (!player) return
    const id = window.setInterval(() => setCurrentTime(player.getCurrentTime()), 250)
    return () => window.clearInterval(id)
  }, [player])

  return { containerRef, player, currentTime, duration, error }
}
