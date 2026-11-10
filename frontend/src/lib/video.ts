import { useEffect, useMemo, useRef, useState } from "react"

/** The slice of a player the timed assessment stage needs. */
export interface StagePlayer {
  playVideo(): void
  pauseVideo(): void
}

/**
 * Drive a native <video> (uploaded assessment videos) with the same
 * play/pause/current-time shape as the YouTube player hook.
 */
export function useFileVideoPlayer(onEnded?: () => void) {
  const [el, setEl] = useState<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const onEndedRef = useRef(onEnded)

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime)
    const onEnd = () => onEndedRef.current?.()
    const onError = () => setError("This video couldn't be played.")
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("seeked", onTime)
    el.addEventListener("ended", onEnd)
    el.addEventListener("error", onError)
    return () => {
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("seeked", onTime)
      el.removeEventListener("ended", onEnd)
      el.removeEventListener("error", onError)
    }
  }, [el])

  const player = useMemo<StagePlayer | null>(
    () =>
      el
        ? {
            playVideo: () => void el.play().catch(() => {}),
            pauseVideo: () => el.pause(),
          }
        : null,
    [el]
  )

  return { videoRef: setEl, player, currentTime, error }
}
