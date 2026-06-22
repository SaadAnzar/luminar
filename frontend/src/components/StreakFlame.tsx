import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import { FireIcon } from "@hugeicons/core-free-icons"
import { NumberCounter } from "@/components/motion/NumberCounter"

export function StreakFlame({ days }: { days: number }) {
  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ rotate: -8, scale: 0.9 }}
        animate={{ rotate: [0, -4, 4, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        className="text-orange-500"
      >
        <HugeiconsIcon icon={FireIcon} size={18} />
      </motion.div>
      <span className="text-sm font-medium">
        <NumberCounter value={days} /> day{days === 1 ? "" : "s"}
      </span>
    </div>
  )
}
