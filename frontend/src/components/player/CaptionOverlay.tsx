import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { CaptionSegment } from "@/lib/schemas"

interface Props {
  segments: CaptionSegment[] | null | undefined
  positionMs: number
}

export function CaptionOverlay({ segments, positionMs }: Props) {
  const current = useMemo(() => {
    if (!segments?.length) return null
    // Binary search for the current segment
    let lo = 0
    let hi = segments.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const seg = segments[mid]
      if (positionMs < seg.start_ms) hi = mid - 1
      else if (positionMs >= seg.end_ms) lo = mid + 1
      else return seg
    }
    return null
  }, [segments, positionMs])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-6">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.start_ms}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.15 }}
            className="rounded-md bg-black/70 px-4 py-1.5 text-center text-sm font-medium text-white backdrop-blur-sm max-w-2xl"
          >
            {current.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
