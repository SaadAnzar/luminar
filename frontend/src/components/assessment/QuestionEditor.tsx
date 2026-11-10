import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiMagicIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Clock01Icon,
  Delete02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { assessmentApi, apiErrorMessage } from "@/lib/api"
import type { DraftQuestion } from "@/lib/schemas"
import { formatTime, parseTime } from "@/lib/youtube"
import { cn } from "@/lib/utils"

const LETTERS = ["A", "B", "C", "D"]

export function QuestionEditor({
  index,
  total,
  value,
  timed,
  readOnly,
  onChange,
  onRemove,
  onMove,
}: {
  index: number
  total: number
  value: DraftQuestion
  timed: boolean
  readOnly?: boolean
  onChange: (q: DraftQuestion) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [timeText, setTimeText] = useState(formatTime(value.time_s))
  const [instruction, setInstruction] = useState("")
  const [rewriting, setRewriting] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const set = (patch: Partial<DraftQuestion>) => onChange({ ...value, ...patch })

  async function rewrite() {
    if (!instruction.trim()) return
    setRewriting(true)
    try {
      const q = await assessmentApi.modifyQuestion(value, instruction)
      onChange({ ...q, id: value.id, time_s: value.time_s })
      setInstruction("")
      setAiOpen(false)
      toast.success("Question rewritten")
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not rewrite the question"))
    } finally {
      setRewriting(false)
    }
  }

  return (
    <div className="edge-light rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
          Q{index + 1}
        </span>
        {timed && (
          <label className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <HugeiconsIcon icon={Clock01Icon} size={13} />
            Pause at
            <Input
              value={timeText}
              disabled={readOnly}
              onChange={(e) => setTimeText(e.target.value)}
              onBlur={() => {
                const t = parseTime(timeText)
                if (t === null) {
                  setTimeText(formatTime(value.time_s))
                  toast.error("Use m:ss, e.g. 2:15")
                } else {
                  set({ time_s: t })
                  setTimeText(formatTime(t))
                }
              }}
              className="h-7 w-20 text-xs"
              aria-label="Pause time"
            />
          </label>
        )}
        {!readOnly && (
          <div className="ml-auto flex items-center gap-1">
            {!timed && (
              <>
                <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
                  <HugeiconsIcon icon={ArrowUp01Icon} />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
                  <HugeiconsIcon icon={ArrowDown01Icon} />
                </Button>
              </>
            )}
            <Popover open={aiOpen} onOpenChange={setAiOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 rounded-full">
                  <HugeiconsIcon icon={AiMagicIcon} /> Rewrite with AI
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-2">
                <p className="text-xs font-medium">How should this question change?</p>
                <Textarea
                  rows={2}
                  autoFocus
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Make it harder and about real-world use"
                  className="text-sm"
                />
                <Button size="sm" className="w-full" disabled={rewriting || !instruction.trim()} onClick={rewrite}>
                  {rewriting ? "Rewriting…" : "Rewrite"}
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Delete question">
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
        )}
      </div>

      <Textarea
        rows={2}
        value={value.question}
        disabled={readOnly}
        onChange={(e) => set({ question: e.target.value })}
        placeholder="Question"
        className="mb-3 resize-none text-sm font-medium"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {value.options.map((opt, i) => {
          const correct = value.correct_index === i
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-1.5 pl-2 transition-colors",
                correct ? "border-emerald-500/60 bg-emerald-500/5" : "border-border"
              )}
            >
              <button
                type="button"
                disabled={readOnly}
                onClick={() => set({ correct_index: i })}
                title={correct ? "Correct answer" : "Mark as correct"}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-muted-foreground hover:border-emerald-500"
                )}
              >
                {correct ? <HugeiconsIcon icon={Tick02Icon} size={12} /> : LETTERS[i]}
              </button>
              <Input
                value={opt}
                disabled={readOnly}
                onChange={(e) => set({ options: value.options.map((o, j) => (j === i ? e.target.value : o)) })}
                placeholder={`Option ${LETTERS[i]}`}
                className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          value={value.hint ?? ""}
          disabled={readOnly}
          onChange={(e) => set({ hint: e.target.value })}
          placeholder="Fallback hint (optional)"
          className="h-8 text-xs"
        />
        <Input
          value={value.explanation ?? ""}
          disabled={readOnly}
          onChange={(e) => set({ explanation: e.target.value })}
          placeholder="Explanation shown after a correct answer (optional)"
          className="h-8 text-xs"
        />
      </div>
    </div>
  )
}
