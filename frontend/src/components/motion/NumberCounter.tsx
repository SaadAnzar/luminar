import { useEffect, useRef } from "react"
import { animate, useInView, useMotionValue, useTransform, motion } from "framer-motion"

export function NumberCounter({
  value,
  duration = 1.2,
  className,
  suffix,
  format,
}: {
  value: number
  duration?: number
  className?: string
  suffix?: string
  format?: (n: number) => string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (n) =>
    format ? format(n) : Math.round(n).toLocaleString(),
  )

  useEffect(() => {
    if (!inView) return
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [inView, mv, value, duration])

  return (
    <span ref={ref} className={className}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  )
}
