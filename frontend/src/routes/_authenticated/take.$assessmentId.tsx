import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  BulbIcon,
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
import type { AnswerResult, AnswerState, Assessment, AssessmentQuestion } from "@/lib/schemas"
import { formatTime, useYouTubePlayer, youtubeVideoId } from "@/lib/youtube"
import { useFileVideoPlayer, type StagePlayer } from "@/lib/video"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/take/$assessmentId")({
  component: TakePage,
})

type Stage = "intro" | "video" | "list" | "done"

/** Per-question outcome for this learner (seeded from saved progress). */
interface QuestionResult {
  attempts: number
  solved: boolean
  hints: number
}
type Results = Record<string, QuestionResult>

const isTimed = (a: Assessment) => a.source_type === "youtube" || a.source_type === "upload"

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
  return <TakeFlow key={assessment.data.id} a={assessment.data} saved={progress.data ?? []} />
}

function TakeFlow({ a, saved }: { a: Assessment; saved: AnswerState[] }) {
  const timed = isTimed(a)
  const total = a.questions.length
  const [stage, setStage] = useState<Stage>("intro")
  const [results, setResults] = useState<Results>(() =>
    Object.fromEntries(saved.map((p) => [p.question_id, { attempts: p.attempts, solved: p.solved, hints: p.hints_used }]))
  )
  const solved = useMemo(
    () => new Set(Object.entries(results).filter(([, r]) => r.solved).map(([id]) => id)),
    [results]
  )

  function recordAttempt(questionId: string, r: AnswerResult) {
    setResults((prev) => {
      const cur = prev[questionId] ?? { attempts: 0, solved: false, hints: 0 }
      if (cur.solved) return prev
      return {
        ...prev,
        [questionId]: {
          // Recorded answers carry the server's running count; owner previews count locally.
          attempts: r.recorded ? r.attempts : cur.attempts + 1,
          solved: r.is_correct,
          hints: cur.hints + (!r.is_correct && r.hint ? 1 : 0),
        },
      }
    })
  }

  const allDone = solved.size >= total
  const stageProps = { a, solved, onAttempt: recordAttempt }

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
        a.source_type === "upload"
          ? <FileVideoStage {...stageProps} onEnded={() => setStage("done")} onFallback={() => setStage("list")} />
          : <YouTubeStage {...stageProps} onEnded={() => setStage("done")} onFallback={() => setStage("list")} />
      )}
      {stage === "list" && <ListStage {...stageProps} onDone={() => setStage("done")} />}
      {stage === "done" && (
        <Done a={a} results={results} timed={timed}
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
      {a.source_type === "youtube" && videoId && (
        <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
      )}
      {a.source_type === "upload" && a.video_url && (
        <video src={a.video_url} preload="metadata" muted playsInline className="aspect-video w-full bg-black object-contain" />
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

interface StageProps {
  a: Assessment
  solved: Set<string>
  onAttempt: (questionId: string, r: AnswerResult) => void
}

interface VideoStageProps extends StageProps {
  onEnded: () => void
  onFallback: () => void
}

function YouTubeStage(props: VideoStageProps) {
  const { containerRef, player, currentTime, error } = useYouTubePlayer(youtubeVideoId(props.a.youtube_url), props.onEnded)
  return (
    <TimedStage {...props} player={player} currentTime={currentTime} error={error} openUrl={props.a.youtube_url}
      media={<div ref={containerRef} className="absolute inset-0 [&_iframe]:size-full" />} />
  )
}

function FileVideoStage(props: VideoStageProps) {
  const { videoRef, player, currentTime, error } = useFileVideoPlayer(props.onEnded)
  return (
    <TimedStage {...props} player={player} currentTime={currentTime} error={error} openUrl={props.a.video_url}
      media={<video ref={videoRef} src={props.a.video_url ?? undefined} controls playsInline autoPlay className="absolute inset-0 size-full bg-black" />} />
  )
}

function TimedStage({ a, solved, onAttempt, onEnded, onFallback, player, currentTime, error, openUrl, media }: VideoStageProps & {
  player: StagePlayer | null; currentTime: number; error: string | null; openUrl?: string | null; media: ReactNode
}) {
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
        {media}
        {current && (
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-background/70 p-3 backdrop-blur-md md:items-center md:p-8">
            <div className="w-full max-w-xl">
              <AnswerCard
                key={current.id}
                assessmentId={a.id}
                question={current}
                number={index + 1}
                total={timeline.length}
                onAttempt={(r) => onAttempt(current.id, r)}
                onSolved={() => setPinned(current.id)}
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
          {openUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={openUrl} target="_blank" rel="noreferrer">Open the video</a>
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
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              solved.has(q.id)
                ? "bg-emerald-500/15 text-emerald-600"
                : skipped.has(q.id)
                  ? "bg-amber-500/15 text-amber-600"
                  : "bg-muted text-muted-foreground"
            )}
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

function ListStage({ a, solved, onAttempt, onDone }: StageProps & { onDone: () => void }) {
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
        onAttempt={(r) => onAttempt(current.id, r)}
        onSolved={() => {}}
        onContinue={next}
        onSkip={next}
      />
    </div>
  )
}

function outcome(r: QuestionResult | undefined): { label: string; tone: string } {
  if (!r || r.attempts === 0) return { label: "Not answered", tone: "bg-muted text-muted-foreground" }
  if (r.solved && r.attempts === 1) return { label: "First try", tone: "bg-emerald-500/15 text-emerald-600" }
  if (r.solved) return { label: `Solved in ${r.attempts} tries`, tone: "bg-sky-500/15 text-sky-600" }
  return { label: `Not solved yet · ${r.attempts} ${r.attempts === 1 ? "try" : "tries"}`, tone: "bg-amber-500/15 text-amber-600" }
}

function Done({ a, results, timed, onReview, onRewatch }: {
  a: Assessment; results: Results; timed: boolean; onReview: () => void; onRewatch: () => void
}) {
  const total = a.questions.length
  const solvedCount = a.questions.filter((q) => results[q.id]?.solved).length
  const firstTry = a.questions.filter((q) => results[q.id]?.solved && results[q.id]?.attempts === 1).length
  const remaining = total - solvedCount
  return (
    <div className="space-y-4">
      <div className="edge-light flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card px-6 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} />
        </div>
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {remaining === 0 ? "All done — nice work!" : `${solvedCount} of ${total} solved`}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {firstTry} of {total} right on the first try.{" "}
            {remaining === 0
              ? a.is_owner ? "That's the full learner experience." : "Your answers have been shared with the author."
              : `${remaining} question${remaining === 1 ? "" : "s"} still open.`}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {remaining > 0 && <Button onClick={onReview} className="rounded-full px-5">Answer the rest</Button>}
          {timed && <Button variant="outline" onClick={onRewatch} className="rounded-full px-5">Rewatch</Button>}
          <Button asChild variant="ghost" className="rounded-full"><Link to="/home">Back home</Link></Button>
        </div>
      </div>

      <div className="edge-light divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {a.questions.map((q, i) => {
          const r = results[q.id]
          const o = outcome(r)
          return (
            <div key={q.id} className="flex items-start gap-3 p-4" data-testid="breakdown-row">
              <span className="text-muted-foreground w-7 shrink-0 pt-0.5 text-xs font-semibold">Q{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{q.question}</p>
                {timed && <p className="text-muted-foreground mt-0.5 text-xs">at {formatTime(q.time_s)}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", o.tone)}>{o.label}</span>
                {r && r.hints > 0 && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                    <HugeiconsIcon icon={BulbIcon} size={11} />{r.hints} hint{r.hints === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
