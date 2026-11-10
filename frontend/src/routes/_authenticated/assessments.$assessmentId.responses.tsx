import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { BulbIcon, CheckmarkCircle02Icon, Link01Icon, Target02Icon, UserGroupIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FadeIn } from "@/components/motion/FadeIn"
import { assessmentApi } from "@/lib/api"
import { cn, initials } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/assessments/$assessmentId/responses")({
  component: ResponsesPage,
})

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0
}

function Stat({ icon, label, value }: { icon: typeof UserGroupIcon; label: string; value: string }) {
  return (
    <div className="edge-light flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
        <HugeiconsIcon icon={icon} size={18} />
      </div>
      <div>
        <div className="font-heading text-2xl leading-none font-bold tracking-tight">{value}</div>
        <div className="text-muted-foreground mt-1 text-xs">{label}</div>
      </div>
    </div>
  )
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${value}%` }} />
    </div>
  )
}

function ResponsesPage() {
  const { assessmentId } = Route.useParams()
  const assessment = useQuery({ queryKey: ["assessment", assessmentId], queryFn: () => assessmentApi.get(assessmentId) })
  const responses = useQuery({ queryKey: ["assessment-responses", assessmentId], queryFn: () => assessmentApi.responses(assessmentId) })

  if (assessment.isLoading || responses.isLoading) {
    return <div className="mx-auto max-w-5xl space-y-3 px-6 py-10">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
  }
  if (!assessment.data || !responses.data) {
    return <div className="text-muted-foreground py-24 text-center text-sm">Results not found.</div>
  }

  const a = assessment.data
  const { learners, questions, total_questions } = responses.data
  const totalSolved = learners.reduce((s, l) => s + l.solved, 0)
  const totalFirstTry = learners.reduce((s, l) => s + l.first_try_correct, 0)
  const totalHints = learners.reduce((s, l) => s + l.hints_used, 0)
  const completed = learners.filter((l) => l.solved === total_questions).length
  const hardest = [...questions].filter((q) => q.answered > 0).sort((x, y) => y.avg_attempts - x.avg_attempts)[0]

  async function copyLink() {
    const url = `${window.location.origin}/take/${a.id}`
    try { await navigator.clipboard.writeText(url); toast.success("Link copied") } catch { toast.error(url) }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <FadeIn className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link to="/assessments" className="text-muted-foreground hover:text-foreground text-xs">← Assessments</Link>
          <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight">{a.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {a.published ? "Published" : "Draft — publish it so learners can open the link"} · {total_questions} questions
          </p>
        </div>
        {a.published && (
          <Button variant="outline" className="gap-1.5 rounded-full" onClick={copyLink}>
            <HugeiconsIcon icon={Link01Icon} /> Copy share link
          </Button>
        )}
      </FadeIn>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={UserGroupIcon} label="Learners" value={String(learners.length)} />
        <Stat icon={CheckmarkCircle02Icon} label="Finished everything" value={String(completed)} />
        <Stat icon={Target02Icon} label="First-try accuracy" value={`${pct(totalFirstTry, totalSolved)}%`} />
        <Stat icon={BulbIcon} label="Hints given" value={String(totalHints)} />
      </div>

      {learners.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed border-border/70 py-16 text-center text-sm">
          No responses yet. Share the link and results will show up here as learners answer.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <h2 className="font-heading mb-3 text-lg font-semibold">Learners</h2>
            <div className="edge-light divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {learners.map((l) => (
                <div key={l.user_id} className="flex items-center gap-3 p-4">
                  <Avatar className="size-9">
                    <AvatarImage src={l.avatar_url ?? ""} />
                    <AvatarFallback>{initials(l.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="text-muted-foreground truncate text-xs">{l.email}</div>
                    <div className="mt-2"><Bar value={pct(l.solved, l.total_questions)} className="bg-primary" /></div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold">{l.solved}/{l.total_questions} solved</div>
                    <div className="text-muted-foreground">
                      {l.first_try_correct} first try · {l.hints_used} hint{l.hints_used === 1 ? "" : "s"}
                    </div>
                    <div className="text-muted-foreground">{new Date(l.last_activity).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2">
            <h2 className="font-heading mb-3 text-lg font-semibold">Questions</h2>
            <div className="space-y-2">
              {questions.map((q) => {
                const firstTry = pct(q.first_try_correct, q.answered)
                return (
                  <div
                    key={q.question_id}
                    className={cn(
                      "edge-light rounded-2xl border bg-card p-3",
                      hardest?.question_id === q.question_id ? "border-amber-500/50" : "border-border/60"
                    )}
                  >
                    <div className="mb-1.5 flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground font-semibold">Q{q.position + 1}</span>
                      <span className="line-clamp-2 flex-1">{q.question}</span>
                    </div>
                    <Bar value={firstTry} className={firstTry >= 70 ? "bg-emerald-500" : firstTry >= 40 ? "bg-amber-500" : "bg-red-500"} />
                    <div className="text-muted-foreground mt-1.5 flex justify-between text-xs">
                      <span>{firstTry}% first try · {q.answered} answered</span>
                      <span>{q.avg_attempts} avg tries</span>
                    </div>
                    {hardest?.question_id === q.question_id && q.avg_attempts > 1 && (
                      <div className="mt-1 text-[11px] font-medium text-amber-600">Hardest question — worth revisiting</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
