import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Analytics01Icon,
  Copy01Icon,
  Delete02Icon,
  Link01Icon,
  PencilEdit02Icon,
  PlayListIcon,
  TaskDone01Icon,
  Video01Icon,
  ViewIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FadeIn } from "@/components/motion/FadeIn"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { assessmentApi, apiErrorMessage } from "@/lib/api"
import type { AssessmentSummary } from "@/lib/schemas"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/assessments/")({
  component: AssessmentsPage,
})

function shareUrl(id: string) {
  return `${window.location.origin}/take/${id}`
}

function AssessmentRow({ a }: { a: AssessmentSummary }) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ["assessments"] })

  const publish = useMutation({
    mutationFn: (published: boolean) => assessmentApi.setPublished(a.id, published),
    onSuccess: refresh,
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  const duplicate = useMutation({
    mutationFn: () => assessmentApi.duplicate(a.id),
    onSuccess: () => { refresh(); toast.success("Duplicated as a draft") },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: () => assessmentApi.remove(a.id),
    onSuccess: () => { refresh(); toast.success("Deleted") },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl(a.id))
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy — the link is " + shareUrl(a.id))
    }
  }

  return (
    <div className="edge-light flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center">
      <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
        <HugeiconsIcon icon={a.source_type === "youtube" ? YoutubeIcon : a.source_type === "upload" ? Video01Icon : PlayListIcon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/assessments/$assessmentId/edit" params={{ assessmentId: a.id }} className="font-heading truncate font-semibold hover:underline">
            {a.title}
          </Link>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            a.published ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
          )}>
            {a.published ? "Published" : "Draft"}
          </span>
          {a.published && a.listed && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">In Discover</span>
          )}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          {a.question_count} question{a.question_count === 1 ? "" : "s"} · {a.submission_count} learner{a.submission_count === 1 ? "" : "s"}
          {a.objective ? ` · ${a.objective}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="text-muted-foreground mr-1 inline-flex items-center gap-1.5 text-xs">
          Live
          <Switch checked={a.published} disabled={publish.isPending} onCheckedChange={(v) => publish.mutate(v)} />
        </label>
        {a.published && (
          <Button variant="outline" size="sm" className="gap-1" onClick={copyLink}>
            <HugeiconsIcon icon={Link01Icon} /> Link
          </Button>
        )}
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to="/assessments/$assessmentId/responses" params={{ assessmentId: a.id }}>
            <HugeiconsIcon icon={Analytics01Icon} /> Results
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" title="Preview">
          <Link to="/take/$assessmentId" params={{ assessmentId: a.id }}><HugeiconsIcon icon={ViewIcon} /></Link>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" title="Edit">
          <Link to="/assessments/$assessmentId/edit" params={{ assessmentId: a.id }}><HugeiconsIcon icon={PencilEdit02Icon} /></Link>
        </Button>
        <Button variant="ghost" size="icon-sm" title="Duplicate" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>
          <HugeiconsIcon icon={Copy01Icon} />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" title="Delete"><HugeiconsIcon icon={Delete02Icon} /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{a.title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the assessment and all {a.submission_count} learner result{a.submission_count === 1 ? "" : "s"}. It can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function AssessmentsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => assessmentApi.mine(),
  })

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <FadeIn className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground mt-1.5 max-w-lg text-sm">
            Turn any YouTube video or luminar into an interactive check-in. Share the link — learners answer as they
            watch, get AI hints when they slip, and you see exactly where they struggle.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2 rounded-full px-6 shadow-lg shadow-primary/20">
          <Link to="/assessments/new"><HugeiconsIcon icon={Add01Icon} size={17} />New assessment</Link>
        </Button>
      </FadeIn>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 py-20 text-center">
          <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
            <HugeiconsIcon icon={TaskDone01Icon} size={26} />
          </div>
          <p className="text-muted-foreground max-w-xs text-sm">No assessments yet. Create one from a YouTube video in under a minute.</p>
        </div>
      ) : (
        <Stagger className="space-y-3">
          {data.map((a) => <StaggerItem key={a.id}><AssessmentRow a={a} /></StaggerItem>)}
        </Stagger>
      )}
    </div>
  )
}
