import { useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  AiMagicIcon,
  Alert02Icon,
  Copy01Icon,
  PlayListIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FadeIn } from "@/components/motion/FadeIn"
import { QuestionEditor } from "@/components/assessment/QuestionEditor"
import { emptyQuestion } from "@/lib/assessment"
import { assessmentApi, apiErrorMessage, luminarApi } from "@/lib/api"
import type { Assessment, AssessmentSourceType, DraftQuestion } from "@/lib/schemas"
import { formatTime, youtubeVideoId } from "@/lib/youtube"
import { cn } from "@/lib/utils"

function toDraft(a: Assessment): DraftQuestion[] {
  return a.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index ?? 0,
    hint: q.hint ?? "",
    explanation: q.explanation ?? "",
    time_s: q.time_s ?? null,
  }))
}

function validate(questions: DraftQuestion[], timed: boolean): string | null {
  if (!questions.length) return "Add at least one question"
  for (const [i, q] of questions.entries()) {
    if (!q.question.trim()) return `Q${i + 1} needs question text`
    if (q.options.some((o) => !o.trim())) return `Q${i + 1} needs all 4 options`
    if (timed && (q.time_s === null || q.time_s === undefined)) return `Q${i + 1} needs a pause time`
  }
  return null
}

/** Create a new assessment, or edit an existing one (`initial`). */
export function AssessmentBuilder({ initial }: { initial?: Assessment }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const editing = !!initial
  const locked = editing && initial.submission_count > 0

  const [sourceType, setSourceType] = useState<AssessmentSourceType>(initial?.source_type ?? "youtube")
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtube_url ?? "")
  const [luminarId, setLuminarId] = useState(initial?.luminar_id ?? "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [objective, setObjective] = useState(initial?.objective ?? "")
  const [numQuestions, setNumQuestions] = useState("5")
  const [questions, setQuestions] = useState<DraftQuestion[]>(initial ? toDraft(initial) : [])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const timed = sourceType === "youtube"
  const videoId = youtubeVideoId(youtubeUrl)

  const { data: luminars = [] } = useQuery({
    queryKey: ["my-luminars"],
    queryFn: () => luminarApi.myLuminars(),
    enabled: sourceType === "luminar",
  })
  const readyLuminars = useMemo(() => luminars.filter((l) => l.status === "ready"), [luminars])

  const sourceReady = timed ? !!videoId : !!luminarId

  async function generate() {
    if (!sourceReady) {
      toast.error(timed ? "Paste a valid YouTube link first" : "Pick a luminar first")
      return
    }
    setGenerating(true)
    try {
      const drafted = await assessmentApi.draftQuestions({
        source_type: sourceType,
        youtube_url: timed ? youtubeUrl : null,
        luminar_id: timed ? null : luminarId,
        num_questions: Number(numQuestions),
        objective: objective || null,
      })
      setQuestions((prev) => {
        const merged = [...prev, ...drafted]
        return timed ? merged.sort((a, b) => (a.time_s ?? 0) - (b.time_s ?? 0)) : merged
      })
      if (!title.trim() && !timed) {
        const l = readyLuminars.find((x) => x.id === luminarId)
        if (l) setTitle(`${l.title} — check-in`)
      }
      toast.success(`Added ${drafted.length} questions`)
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not generate questions"))
    } finally {
      setGenerating(false)
    }
  }

  async function save(publish: boolean) {
    if (!title.trim()) return toast.error("Give your assessment a title")
    if (!sourceReady) return toast.error(timed ? "Paste a valid YouTube link" : "Pick a luminar")
    const problem = locked ? null : validate(questions, timed)
    if (problem) return toast.error(problem)

    setSaving(true)
    try {
      let saved: Assessment
      if (editing) {
        saved = await assessmentApi.update(initial.id, {
          title,
          objective: objective || null,
          ...(locked ? {} : { questions }),
        })
        if (publish !== saved.published) await assessmentApi.setPublished(saved.id, publish)
      } else {
        saved = await assessmentApi.create({
          title,
          objective: objective || null,
          source_type: sourceType,
          youtube_url: timed ? youtubeUrl : null,
          luminar_id: timed ? null : luminarId,
          questions,
          published: publish,
        })
      }
      qc.invalidateQueries({ queryKey: ["assessments"] })
      qc.invalidateQueries({ queryKey: ["assessment", saved.id] })
      if (publish) {
        await navigator.clipboard?.writeText(`${window.location.origin}/take/${saved.id}`).catch(() => {})
        toast.success("Published — share link copied")
      } else {
        toast.success("Saved")
      }
      nav({ to: "/assessments" })
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save"))
      setSaving(false)
    }
  }

  async function duplicate() {
    if (!initial) return
    try {
      const copy = await assessmentApi.duplicate(initial.id)
      qc.invalidateQueries({ queryKey: ["assessments"] })
      nav({ to: "/assessments/$assessmentId/edit", params: { assessmentId: copy.id } })
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not duplicate"))
    }
  }

  const updateAt = (i: number, q: DraftQuestion) => setQuestions((prev) => prev.map((x, j) => (j === i ? q : x)))
  const removeAt = (i: number) => setQuestions((prev) => prev.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) =>
    setQuestions((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const addManual = () => {
    const last = questions[questions.length - 1]?.time_s ?? 0
    setQuestions((prev) => [...prev, emptyQuestion(timed ? last + 30 : null)])
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <FadeIn className="mb-6">
        <Link to="/assessments" className="text-muted-foreground hover:text-foreground text-xs">← Assessments</Link>
        <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight">
          {editing ? "Edit assessment" : "New assessment"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Questions pop up while learners watch. Wrong answers get an AI hint and another try.
        </p>
      </FadeIn>

      {locked && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <HugeiconsIcon icon={Alert02Icon} size={18} className="text-amber-600" />
          <span className="flex-1">
            {initial.submission_count} learner{initial.submission_count === 1 ? " has" : "s have"} already answered.
            Questions are locked so results stay valid — duplicate to change them.
          </span>
          <Button variant="outline" size="sm" className="gap-1" onClick={duplicate}>
            <HugeiconsIcon icon={Copy01Icon} /> Duplicate
          </Button>
        </div>
      )}

      {/* Source */}
      <section className="edge-light mb-5 space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: "youtube", label: "YouTube video", icon: YoutubeIcon },
            { v: "luminar", label: "One of my luminars", icon: PlayListIcon },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={editing}
              onClick={() => { setSourceType(o.v); setQuestions([]) }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                sourceType === o.v ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                editing && sourceType !== o.v && "opacity-40"
              )}
            >
              <HugeiconsIcon icon={o.icon} size={16} /> {o.label}
            </button>
          ))}
        </div>

        {timed ? (
          <div className="space-y-2">
            <Input
              type="url"
              disabled={editing}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            {youtubeUrl && !videoId && <p className="text-xs text-red-600">That doesn't look like a YouTube video link.</p>}
            {videoId && (
              <img
                src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                alt="Video thumbnail"
                className="h-24 rounded-lg border border-border object-cover"
              />
            )}
          </div>
        ) : (
          <Select value={luminarId} onValueChange={setLuminarId} disabled={editing}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose a finished luminar" /></SelectTrigger>
            <SelectContent>
              {readyLuminars.length === 0 && (
                <div className="text-muted-foreground px-2 py-1.5 text-xs">No finished luminars yet.</div>
              )}
              {readyLuminars.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Learning objective (optional)" />
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <Select value={numQuestions} onValueChange={setNumQuestions}>
              <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["3", "5", "8", "10", "15"].map((n) => <SelectItem key={n} value={n}>{n} questions</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={generate} disabled={generating || !sourceReady} className="gap-1.5 rounded-full">
              <HugeiconsIcon icon={AiMagicIcon} />
              {generating ? "Generating…" : questions.length ? "Generate more" : "Generate with AI"}
            </Button>
            <Button variant="outline" onClick={addManual} className="gap-1.5 rounded-full">
              <HugeiconsIcon icon={Add01Icon} /> Add manually
            </Button>
          </div>
        )}
      </section>

      {/* Questions */}
      <section className="space-y-3">
        {questions.length === 0 ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed border-border/70 py-14 text-center text-sm">
            No questions yet — generate them from the video or add your own.
          </div>
        ) : (
          questions.map((q, i) => (
            <QuestionEditor
              key={q.id ?? `new-${i}-${questions.length}`}
              index={i}
              total={questions.length}
              value={q}
              timed={timed}
              readOnly={locked}
              onChange={(nq) => updateAt(i, nq)}
              onRemove={() => removeAt(i)}
              onMove={(dir) => move(i, dir)}
            />
          ))
        )}
        {timed && questions.length > 1 && !locked && (
          <p className="text-muted-foreground text-xs">
            Questions are shown in time order on save ({questions.map((q) => formatTime(q.time_s)).join(" · ")}).
          </p>
        )}
      </section>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-border/60 bg-background/90 py-4 backdrop-blur">
        <Button variant="outline" size="lg" disabled={saving} onClick={() => save(false)} className="rounded-full px-5">
          {editing && initial.published ? "Save & unpublish" : "Save draft"}
        </Button>
        <Button size="lg" disabled={saving} onClick={() => save(true)} className="rounded-full px-5 shadow-lg shadow-primary/20">
          {saving ? "Saving…" : editing && initial.published ? "Save" : "Publish & copy link"}
        </Button>
      </div>
    </div>
  )
}
