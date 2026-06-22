import { motion, type HTMLMotionProps } from "framer-motion"
import type { ReactNode } from "react"

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode
  delay?: number
  y?: number
  duration?: number
}

export function FadeIn({
  children,
  delay = 0,
  y = 8,
  duration = 0.4,
  ...rest
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
