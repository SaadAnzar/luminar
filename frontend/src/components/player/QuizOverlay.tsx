import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  SparklesIcon,
  ArrowRight02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { QuizCard } from "@/lib/schemas"
import { quizApi } from "@/lib/api"

interface Props {
  card: QuizCard
  onComplete: () => void
}

export function QuizOverlay({ card, onComplete }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    is_correct: boolean
    explanation: string | null
    correct_index: number
  } | null>(null)
  const startMs = useRef(0)
  useEffect(() => { startMs.current = Date.now() }, [])

  async function onSubmit() {
    if (selected === null) return
    setSubmitting(true)
    const timeMs = Date.now() - startMs.current
    try {
      const r = await quizApi.attempt(card.id, selected, hintUsed, timeMs)
      setResult(r)
    } finally {
      setSubmitting(false)
    }
  }

  function showHint() {
    setHintVisible(true)
    setHintUsed(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-md"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-card ring-border w-full max-w-lg rounded-2xl p-5 ring-1 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <HugeiconsIcon icon={SparklesIcon} size={15} />
            </div>
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Quick check</span>
          </div>
          {card.hint && !result && (
            <button
              onClick={showHint}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
            >
              <HugeiconsIcon icon={InformationCircleIcon} size={14} />
              {hintVisible ? "Hint shown" : "Show hint"}
            </button>
          )}
        </div>

        <h3 className="font-heading mt-3 text-base font-semibold tracking-tight">{card.question}</h3>

        <AnimatePresence>
          {hintVisible && card.hint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 overflow-hidden rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2"
            >
              <p className="text-xs text-amber-700">{card.hint}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 space-y-1.5">
          {card.options.map((opt, i) => {
            const isSelected = selected === i
            const isCorrect = result && result.correct_index === i
            const isWrong = result && !result.is_correct && isSelected
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.22 }}
                disabled={!!result}
                onClick={() => setSelected(i)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-all",
                  !result && !isSelected && "hover:border-primary/40 hover:bg-primary/5",
                  isSelected && !result && "border-primary bg-primary/5",
                  isCorrect && "border-emerald-500/60 bg-emerald-500/10",
                  isWrong && "border-destructive/60 bg-destructive/10",
                )}
              >
                <span className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold",
                  "bg-muted text-muted-foreground",
                  isSelected && !result && "bg-primary text-primary-foreground",
                  isCorrect && "bg-emerald-500 text-white",
                  isWrong && "bg-destructive text-destructive-foreground",
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-600" />}
                {isWrong && <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-destructive" />}
              </motion.button>
            )
          })}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-4 rounded-lg border p-3",
                result.is_correct
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-destructive/40 bg-destructive/5",
              )}
            >
              <p className="text-sm font-semibold">{result.is_correct ? "Correct!" : "Not quite."}</p>
              {result.explanation && (
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{result.explanation}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex justify-end gap-2">
          {!result ? (
            <Button onClick={onSubmit} disabled={selected === null || submitting} className="gap-2">
              {submitting ? "Checking…" : "Submit"}
              {!submitting && <HugeiconsIcon icon={ArrowRight02Icon} size={15} />}
            </Button>
          ) : (
            <Button onClick={() => onComplete()} className="gap-2">
              Continue
              <HugeiconsIcon icon={ArrowRight02Icon} size={15} />
            </Button>
          )}
        </div>
      </motion.div>
      </div>
    </motion.div>
  )
}
