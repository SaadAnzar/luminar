import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  ArrowLeft02Icon,
  SparklesIcon,
  Clock01Icon,
  ConversationIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FadeIn } from "@/components/motion/FadeIn"
import { luminarApi } from "@/lib/api"
import type { Scene } from "@/lib/schemas"

export const Route = createFileRoute("/_authenticated/script-review/$luminarId")({
  component: ScriptReviewPage,
})

function ScriptReviewPage() {
  const { luminarId } = Route.useParams()
  const nav = useNavigate()

  const { data: luminar, isLoading: loadingLuminar } = useQuery({
    queryKey: ["luminar", luminarId],
    queryFn: () => luminarApi.get(luminarId),
  })

  const { data: scenes = [], isLoading: loadingScenes } = useQuery({
    queryKey: ["scenes", luminarId],
    queryFn: () => luminarApi.getScenes(luminarId),
    enabled: !!luminar,
  })

  const approveMutation = useMutation({
    mutationFn: () => luminarApi.approveScript(luminarId),
    onSuccess: () => {
      toast.success("Generating Luminar…")
      nav({ to: "/generating/$jobId", params: { jobId: luminarId } })
    },
    onError: () => toast.error("Could not start generation"),
  })

  const isLoading = loadingLuminar || loadingScenes
  const totalDurationMs = scenes.reduce((acc, s) => acc + (s.duration_ms ?? 0), 0)
  const totalSec = Math.round(totalDurationMs / 1000)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-4">
        <Skeleton className="h-10 w-64" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  if (!luminar || luminar.status !== "script_ready") {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10 text-center">
        <p className="text-muted-foreground">
          {luminar?.status === "ready"
            ? "This Luminar is already generated."
            : "Script is not ready yet."}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/home">Back to home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <FadeIn>
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
              <Link to="/home">
                <HugeiconsIcon icon={ArrowLeft02Icon} size={14} className="mr-1" />
                Home
              </Link>
            </Button>
            <h1 className="font-heading text-2xl font-bold">{luminar.title}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Clock01Icon} size={13} />
                ~{luminar.duration_minutes} min ({scenes.length} scenes)
              </span>
              {totalSec > 0 && (
                <span>Estimated {totalSec}s narration</span>
              )}
              {luminar.dialogue_mode && (
                <span className="flex items-center gap-1 text-violet-600">
                  <HugeiconsIcon icon={ConversationIcon} size={13} />
                  Dialogue mode
                </span>
              )}
            </div>
            {luminar.key_concepts && luminar.key_concepts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {luminar.key_concepts.map((c) => (
                  <Badge key={c} variant="secondary" className="rounded-full text-xs font-normal">{c}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              size="lg"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="gap-2 rounded-full"
            >
              <HugeiconsIcon icon={SparklesIcon} size={15} />
              {approveMutation.isPending ? "Starting…" : "Generate Luminar"}
            </Button>
          </div>
        </div>
      </FadeIn>

      <div className="space-y-4">
        {scenes.map((scene, i) => (
          <SceneCard key={scene.id} scene={scene} index={i} />
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          size="lg"
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
          className="gap-2 rounded-full px-8"
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
          {approveMutation.isPending ? "Starting generation…" : "Approve & Generate Luminar"}
        </Button>
      </div>
    </div>
  )
}

function SceneCard({ scene, index }: { scene: Scene; index: number }) {
  const durationSec = Math.round((scene.duration_ms ?? 0) / 1000)
  const narration = scene.narration_text ?? ""
  const cleanNarration = narration
    .replace(/\[VISUAL_CUE:[^\]]*\]/g, "")
    .replace(/\[(Teacher|Student)\]:\s*/g, (_, role) => `**${role}:** `)
    .trim()

  const visualCues = [...narration.matchAll(/\[VISUAL_CUE:([^\]]*)\]/g)].map((m) => m[1].trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{scene.title ?? `Scene ${index + 1}`}</h3>
              <span className="text-[11px] text-muted-foreground capitalize">{scene.visual_style?.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center gap-2">
              {scene.dialogue_mode && (
                <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-300">
                  Dialogue
                </Badge>
              )}
              {durationSec > 0 && (
                <span className="text-[11px] text-muted-foreground">{durationSec}s</span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <ScrollArea className="max-h-40">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {cleanNarration}
              </p>
            </ScrollArea>

            {visualCues.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Visual cues</p>
                  {visualCues.map((cue, j) => (
                    <div key={j} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="mt-0.5 size-1.5 rounded-full bg-primary/40 shrink-0" />
                      {cue}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
