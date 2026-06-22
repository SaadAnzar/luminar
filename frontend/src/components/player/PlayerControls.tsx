import { useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlayIcon,
  PauseIcon,
  Backward01Icon,
  NextIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute01Icon,
  FullscreenIcon,
  ArrowShrink02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn, formatDuration } from "@/lib/utils"

interface Props {
  playing: boolean
  onPlayToggle: () => void
  onPrev: () => void
  onNext: () => void
  position: number
  duration: number
  onSeek: (v: number) => void
  muted: boolean
  onMuteToggle: () => void
  volume: number
  onVolumeChange: (v: number) => void
  speed: number
  onCycleSpeed: () => void
  captionsOn: boolean
  onCaptionsToggle: () => void
  onFullscreen: () => void
  isFullscreen: boolean
  canGoPrev: boolean
  canGoNext: boolean
  chapters?: number[]
  quizMarkers?: number[]
}

export function PlayerControls({
  playing, onPlayToggle, onPrev, onNext,
  position, duration, onSeek,
  muted, onMuteToggle, volume, onVolumeChange,
  speed, onCycleSpeed, captionsOn, onCaptionsToggle,
  onFullscreen, isFullscreen,
  canGoPrev, canGoNext, chapters = [], quizMarkers = [],
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  const max = Math.max(duration, 1)
  const pct = Math.min(100, (position / max) * 100)
  const volIcon = muted || volume === 0 ? VolumeMute01Icon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon

  function seekFromEvent(clientX: number) {
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(Math.round(frac * max))
  }

  return (
    <div className="glass absolute inset-x-3 bottom-3 rounded-xl border px-3 pb-2 pt-3">
      {/* Chaptered scrubber */}
      <div
        ref={barRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={position}
        tabIndex={0}
        className="group relative mb-2 h-4 cursor-pointer touch-none select-none"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekFromEvent(e.clientX) }}
        onPointerMove={(e) => { if (dragging.current) seekFromEvent(e.clientX) }}
        onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId) }}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/15">
          <div className="h-full rounded-full bg-primary transition-[width] duration-75 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        {chapters.map((ms, i) => (
          <span key={`c-${i}`} className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background/80" style={{ left: `${(ms / max) * 100}%` }} />
        ))}
        {quizMarkers.map((ms, i) => (
          <span key={`q-${i}`} title="Quiz checkpoint" className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-2 ring-background" style={{ left: `${(ms / max) * 100}%` }} />
        ))}
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-2 ring-background opacity-0 transition-opacity group-hover:opacity-100" style={{ left: `${pct}%` }} />
      </div>

      {/* Transport row */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-8" onClick={onPrev} disabled={!canGoPrev} aria-label="Previous scene">
          <HugeiconsIcon icon={Backward01Icon} size={15} />
        </Button>
        <Button size="icon" className="size-9 rounded-full" onClick={onPlayToggle} aria-label={playing ? "Pause" : "Play"}>
          <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} size={15} />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onNext} disabled={!canGoNext} aria-label="Next scene">
          <HugeiconsIcon icon={NextIcon} size={15} />
        </Button>

        <span className="text-muted-foreground ml-1.5 font-mono text-[11px] tabular-nums">
          {formatDuration(position)} / {formatDuration(duration)}
        </span>

        <div className="flex-1" />

        {/* speed */}
        <Button variant="ghost" size="sm" className="h-8 px-2 font-mono text-xs tabular-nums" onClick={onCycleSpeed} aria-label="Playback speed" title="Playback speed">
          {speed}×
        </Button>
        {/* captions */}
        <Button
          variant="ghost" size="sm"
          className={cn("h-8 px-2 text-[11px] font-bold tracking-wide", captionsOn ? "text-primary" : "text-muted-foreground")}
          onClick={onCaptionsToggle} aria-label="Toggle captions" title="Captions"
        >
          CC
        </Button>
        {/* volume */}
        <div className="group/vol flex items-center">
          <Button variant="ghost" size="icon" className="size-8" onClick={onMuteToggle} aria-label={muted ? "Unmute" : "Mute"}>
            <HugeiconsIcon icon={volIcon} size={16} />
          </Button>
          <div className="w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-20 group-hover/vol:px-1">
            <Slider value={[muted ? 0 : Math.round(volume * 100)]} max={100} step={1} onValueChange={(v) => onVolumeChange((v[0] ?? 0) / 100)} aria-label="Volume" />
          </div>
        </div>
        {/* fullscreen */}
        <Button variant="ghost" size="icon" className="size-8" onClick={onFullscreen} aria-label="Fullscreen">
          <HugeiconsIcon icon={isFullscreen ? ArrowShrink02Icon : FullscreenIcon} size={16} />
        </Button>
      </div>
    </div>
  )
}
