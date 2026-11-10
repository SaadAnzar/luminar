import { useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon, BulbIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { assessmentApi, apiErrorMessage } from "@/lib/api"
import type { AnswerResult, AssessmentQuestion } from "@/lib/schemas"
import { cn } from "@/lib/utils"

const LETTERS = ["A", "B", "C", "D"]

/**
 * One question: pick → check. Wrong → AI hint, try again. Right → explanation,
 * continue. The learner can also skip and come back later.
 */
export function AnswerCard({
  assessmentId,
  question,
  number,
  total,
  onSolved,
  onAttempt,
  onContinue,
  onSkip,
}: {
  assessmentId: string
  question: AssessmentQuestion
  number: number
  total: number
  onSolved: (result: AnswerResult) => void
  /** Every checked answer, right or wrong (used for the end-of-test breakdown). */
  onAttempt?: (result: AnswerResult) => void
  onContinue: () => void
  onSkip?: () => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [wrong, setWrong] = useState<Set<number>>(new Set())

  const solved = !!result?.is_correct

  async function check() {
    if (selected === null) return
    setChecking(true)
    try {
      const r = await assessmentApi.answer(assessmentId, question.id, selected)
      setResult(r)
      onAttempt?.(r)
      if (r.is_correct) onSolved(r)
      else setWrong((w) => new Set(w).add(selected))
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not check your answer"))
    } finally {
      setChecking(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="edge-light w-full rounded-2xl border border-border/70 bg-card p-5 shadow-xl"
    >
      <div className="text-muted-foreground mb-2 text-xs font-medium">Question {number} of {total}</div>
      <h2 className="font-heading mb-4 text-lg font-semibold leading-snug">{question.question}</h2>

      <div className="grid gap-2">
        {question.options.map((opt, i) => {
          const isWrong = wrong.has(i)
          const isRight = solved && selected === i
          return (
            <button
              key={i}
              type="button"
              disabled={solved || isWrong || checking}
              onClick={() => setSelected(i)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
                isRight && "border-emerald-500 bg-emerald-500/10",
                isWrong && "border-red-500/40 bg-red-500/5 text-muted-foreground line-through",
                !isRight && !isWrong && selected === i && "border-primary bg-primary/5",
                !isRight && !isWrong && selected !== i && "border-border hover:border-primary/40"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  isRight ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
                )}
              >
                {LETTERS[i]}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      {result && !result.is_correct && result.hint && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <HugeiconsIcon icon={BulbIcon} size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span><span className="font-medium">Not quite. </span>{result.hint}</span>
        </div>
      )}
      {solved && (
        <div className="mt-4 flex gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>
            <span className="font-medium">Correct{result.attempts > 1 ? ` (attempt ${result.attempts})` : ""}! </span>
            {result.explanation}
          </span>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        {!solved && onSkip ? (
          <button type="button" onClick={onSkip} className="text-muted-foreground hover:text-foreground text-xs">
            Skip for now
          </button>
        ) : <span />}
        {solved ? (
          <Button onClick={onContinue} className="gap-1.5 rounded-full px-5">
            Continue <HugeiconsIcon icon={ArrowRight02Icon} />
          </Button>
        ) : (
          <Button onClick={check} disabled={selected === null || checking} className="rounded-full px-5">
            {checking ? "Checking…" : result && !result.is_correct ? "Try again" : "Check answer"}
          </Button>
        )}
      </div>
    </motion.div>
  )
}
