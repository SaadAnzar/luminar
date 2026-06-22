import { motion, type HTMLMotionProps, type Variants } from "framer-motion"
import type { ReactNode } from "react"

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
}

export function Stagger({ children, ...rest }: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  ...rest
}: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div variants={itemVariants} {...rest}>
      {children}
    </motion.div>
  )
}
