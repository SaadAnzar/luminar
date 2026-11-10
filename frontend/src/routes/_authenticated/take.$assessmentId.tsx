import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
  PlayListIcon,
  TaskDone01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/motion/FadeIn"
import { AnswerCard } from "@/components/assessment/AnswerCard"
import { assessmentApi } from "@/lib/api"
import type { Assessment, AssessmentQuestion } from "@/lib/schemas"
import { formatTime, useYouTubePlayer, youtubeVideoId } from "@/lib/youtube"

export const Route = createFileRoute("/_authenticated/take/$assessmentId")({
  component: TakePage,
})

type Stage = "intro" | "video" | "list" | "done"

function TakePage() {
  const { assessmentId } = Route.useParams()
  const assessment = useQuery({ queryKey: ["take", assessmentId], queryFn: () => assessmentApi.get(assessmentId), retry: false })
  const progress = useQuery({ queryKey: ["take-progress", assessmentId], queryFn: () => assessmentApi.progress(assessmentId), retry: false })

  if (assessment.isLoading || progress.isLoading) {
    return <div className="mx-auto max-w-3xl space-y-4 px-6 py-10"><Skeleton className="h-10 w-2/3" /><Skeleton className="aspect-video rounded-2xl" /></div>
  }
  if (!assessment.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold">This assessment isn't available</h1>
        <p className="text-muted-foreground mt-2 text-sm">It may be unpublished or deleted. Ask whoever shared it for a new link.</p>
      </div>
    )
  }
  const solvedIds = new Set((progress.data ?? []).filter((p) => p.solved).map((p) => p.question_id))
  return <TakeFlow key={assessment.data.id} a={assessment.data} initiallySolved={solvedIds} />
}

function TakeFlow({ a, initiallySolved }: { a: Assessment; initiallySolved: Set<string> }) {
  const timed = a.source_type === "youtube"
  const total = a.questions.length
  const [stage, setStage] = useState<Stage>("intro")
  const [solved, setSolved] = useState<Set<string>>(initiallySolved)
  const markSolved = (id: string) => setSolved((s) => new Set(s).add(id))
  const allDone = solved.size >= total

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      {a.is_owner && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <HugeiconsIcon icon={ViewIcon} size={14} className="text-primary" />
          Preview{!a.published && " of a draft"} — your answers aren't recorded.
          <Link to="/assessments/$assessmentId/edit" params={{ assessmentId: a.id }} className="text-primary ml-auto font-medium">Edit</Link>
        </div>
      )}

      <FadeIn className="mb-5">
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">{a.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {a.author_name ? `By ${a.author_name} · ` : ""}{total} question{total === 1 ? "" : "s"}
          {solved.size > 0 && ` · ${solved.size} solved`}
        </p>
        {a.objective && <p className="mt-2 text-sm">{a.objective}</p>}
      </FadeIn>

      {stage === "intro" && (
        <Intro a={a} timed={timed} resumed={solved.size > 0} allDone={allDone}
          onStart={() => setStage(allDone ? "done" : timed ? "video" : "list")} />
      )}
      {stage === "video" && (
        <VideoStage a={a} solved={solved} onSolved={markSolved} onEnded={() => setStage("done")}
          onFallback={() => setStage("list")} />
      )}
      {stage === "list" && (
        <ListStage a={a} solved={solved} onSolved={markSolved} onDone={() => setStage("done")} />
      )}
      {stage === "done" && (
        <Done total={total} solved={solved.size} timed={timed} preview={a.is_owner}
          onReview={() => setStage("list")} onRewatch={() => setStage("video")} />
      )}
    </div>
  )
}

function Intro({ a, timed, resumed, allDone, onStart }: {
  a: Assessment; timed: boolean; resumed: boolean; allDone: boolean; onStart: () => void
}) {
  const videoId = youtubeVideoId(a.youtube_url)
  return (
    <div className="edge-light overflow-hidden rounded-2xl border border-border/60 bg-card">
      {timed && videoId && (
        <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
      )}
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground text-sm">
          {timed
            ? "The video pauses when it's time for a question. Get one wrong and you'll get a hint to try again."
            : "Watch the lesson, then answer the questions. Get one wrong and you'll get a hint to try again."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!timed && a.luminar_id && (
            <Button asChild variant="outline" className="gap-1.5 rounded-full">
              <Link to="/watch/$luminarId" params={{ luminarId: a.luminar_id }}>
                <HugeiconsIcon icon={PlayListIcon} /> Watch the lesson
              </Link>
            </Button>
          )}
          <Button onClick={onStart} className="gap-1.5 rounded-full px-5">
            <HugeiconsIcon icon={timed ? PlayIcon : TaskDone01Icon} />
            {allDone ? "See results" : resumed ? "Continue" : timed ? "Start watching" : "Start questions"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function VideoStage({ a, solved, onSolved, onEnded, onFallback }: {
  a: Assessment; solved: Set<string>; onSolved: (id: string) => void; onEnded: () => void; onFallback: () => void
}) {
  const { containerRef, player, currentTime, error } = useYouTubePlayer(youtubeVideoId(a.youtube_url), onEnded)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  // A just-solved question stays on screen until the learner hits Continue.
  const [pinned, setPinned] = useState<string | null>(null)

  const timeline = useMemo(
    () => [...a.questions].sort((x, y) => (x.time_s ?? 0) - (y.time_s ?? 0)),
    [a.questions]
  )
  // Seeking past a question still triggers it — nothing gets skipped silently.
  const due = timeline.find((q) => (q.time_s ?? 0) <= currentTime && !solved.has(q.id) && !skipped.has(q.id))
  const current: AssessmentQuestion | undefined = pinned ? a.questions.find((q) => q.id === pinned) : due

  useEffect(() => {
    if (current && player) player.pauseVideo()
  }, [current, player])

  function resume() {
    setPinned(null)
    player?.playVideo()
  }

  const index = current ? timeline.findIndex((q) => q.id === current.id) : -1

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/60 bg-black">
        <div ref={containerRef} className="absolute inset-0 [&_iframe]:size-full" />
        {current && (
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-background/70 p-3 backdrop-blur-md md:items-center md:p-8">
            <div className="w-full max-w-xl">
              <AnswerCard
                key={current.id}
                assessmentId={a.id}
                question={current}
                number={index + 1}
                total={timeline.length}
                onSolved={() => { onSolved(current.id); setPinned(current.id) }}
                onContinue={resume}
                onSkip={() => { setSkipped((s) => new Set(s).add(current.id)); resume() }}
              />
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm">
          <span className="flex-1 text-red-600">{error}</span>
          {a.youtube_url && (
            <Button asChild variant="outline" size="sm">
              <a href={a.youtube_url} target="_blank" rel="noreferrer">Open on YouTube</a>
            </Button>
          )}
          <Button size="sm" onClick={onFallback}>Answer the questions</Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {timeline.map((q, i) => (
          <span
            key={q.id}
            title={`Q${i + 1} at ${formatTime(q.time_s)}`}
            className={
              solved.has(q.id)
                ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600"
                : skipped.has(q.id)
                  ? "rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600"
                  : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium"
            }
          >
            {formatTime(q.time_s)}
          </span>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={onEnded}>
          Finish <HugeiconsIcon icon={ArrowRight02Icon} />
        </Button>
      </div>
    </div>
  )
}

function ListStage({ a, solved, onSolved, onDone }: {
  a: Assessment; solved: Set<string>; onSolved: (id: string) => void; onDone: () => void
}) {
  // Freeze the queue when the stage opens so solving doesn't reshuffle it.
  const [queue] = useState(() => a.questions.filter((q) => !solved.has(q.id)))
  const [pos, setPos] = useState(0)
  const current = queue[pos]

  useEffect(() => {
    if (!current) onDone()
  }, [current, onDone])

  if (!current) return null
  const next = () => setPos((p) => p + 1)
  return (
    <div className="mx-auto max-w-xl">
      <AnswerCard
        key={current.id}
        assessmentId={a.id}
        question={current}
        number={a.questions.findIndex((q) => q.id === current.id) + 1}
        total={a.questions.length}
        onSolved={() => onSolved(current.id)}
        onContinue={next}
        onSkip={next}
      />
    </div>
  )
}

function Done({ total, solved, timed, preview, onReview, onRewatch }: {
  total: number; solved: number; timed: boolean; preview: boolean; onReview: () => void; onRewatch: () => void
}) {
  const remaining = total - solved
  return (
    <div className="edge-light flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} />
      </div>
      <div>
        <h2 className="font-heading text-xl font-semibold">
          {remaining === 0 ? "All done — nice work!" : `${solved} of ${total} solved`}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {remaining === 0
            ? preview ? "That's the full learner experience." : "Your answers have been shared with the author."
            : `${remaining} question${remaining === 1 ? "" : "s"} still open. You can answer them now.`}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {remaining > 0 && <Button onClick={onReview} className="rounded-full px-5">Answer the rest</Button>}
        {timed && <Button variant="outline" onClick={onRewatch} className="rounded-full px-5">Rewatch</Button>}
        <Button asChild variant="ghost" className="rounded-full"><Link to="/home">Back home</Link></Button>
      </div>
    </div>
  )
}
