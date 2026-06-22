import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Loading03Icon,
  SparklesIcon,
  ArrowRight02Icon,
  AlertCircleIcon,
  File01Icon,
} from "@hugeicons/core-free-icons"
import { Logo } from "@/components/layout/Logo"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { luminarApi } from "@/lib/api"
import { WS_BASE_URL } from "@/lib/api"

export const Route = createFileRoute("/_authenticated/generating/$jobId")({
  component: GeneratingPage,
})

type LuminarStatus = "pending" | "script_generating" | "script_ready" | "assets_generating" | "ready" | "failed"

const PHASE1_STEPS = [
  { label: "Extracting content", floor: 10 },
  { label: "Planning scenes", floor: 20 },
  { label: "Writing script", floor: 38 },
] as const

const PHASE2_STEPS = [
  { label: "Animating", floor: 55 },
  { label: "Recording audio", floor: 70 },
  { label: "Building quizzes", floor: 88 },
  { label: "Finishing up", floor: 97 },
] as const

function GeneratingPage() {
  const { jobId } = Route.useParams()
  const nav = useNavigate()
  const [status, setStatus] = useState<LuminarStatus>("pending")
  const [wsProgress, setWsProgress] = useState<number | null>(null)
  const [wsMessage, setWsMessage] = useState("")
  const [retrying, setRetrying] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  async function handleRetry() {
    setRetrying(true)
    try {
      const { status: newStatus } = await luminarApi.retry(jobId)
      setWsMessage("")
      setWsProgress(null)
      setStatus(newStatus as LuminarStatus)
      setRetryNonce((n) => n + 1) // restart polling
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed")
    } finally {
      setRetrying(false)
    }
  }

  // WebSocket for real-time progress
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/api/v1/luminars/ws/${jobId}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { progress?: number; message?: string }
        if (data.progress !== undefined) setWsProgress(data.progress)
        if (data.message) setWsMessage(data.message)
      } catch {
        /* ignore malformed progress frames */
      }
    }
    ws.onerror = () => ws.close()
    return () => ws.close()
  }, [jobId])

  // Poll status for navigation triggers
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const luminar = await luminarApi.get(jobId)
        setStatus(luminar.status as LuminarStatus)
        if (luminar.status === "script_ready" || luminar.status === "ready" || luminar.status === "failed") {
          clearInterval(poll)
        }
      } catch {
        /* transient fetch error — keep polling */
      }
    }, 3000)
    return () => clearInterval(poll)
  }, [jobId, retryNonce])

  // Navigate when script is ready → review
  useEffect(() => {
    if (status === "script_ready") {
      const t = setTimeout(() => nav({ to: "/script-review/$luminarId", params: { luminarId: jobId } }), 1000)
      return () => clearTimeout(t)
    }
  }, [status, jobId, nav])

  // Navigate when fully done → watch
  useEffect(() => {
    if (status === "ready") {
      const t = setTimeout(() => nav({ to: "/watch/$luminarId", params: { luminarId: jobId } }), 1500)
      return () => clearTimeout(t)
    }
  }, [status, jobId, nav])

  const phase = status === "assets_generating" || status === "ready" ? 2 : 1
  const isPhase1 = phase === 1
  const steps = isPhase1 ? PHASE1_STEPS : PHASE2_STEPS
  const pct = wsProgress ?? (isPhase1 ? 5 : 42)

  const done = status === "ready"
  const scriptReady = status === "script_ready"
  const failed = status === "failed"
  const running = !done && !scriptReady && !failed

  return (
    <div className="from-background via-background to-primary/5 relative min-h-svh bg-gradient-to-b">
      <div className="relative mx-auto flex min-h-svh max-w-3xl flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Link to="/home"><Logo /></Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">Cancel</Link>
          </Button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={cn(
              "mx-auto flex size-14 items-center justify-center rounded-2xl",
              failed ? "bg-destructive/10 text-destructive" :
              scriptReady ? "bg-amber-500/10 text-amber-600" :
              "bg-primary/10 text-primary"
            )}>
              <motion.span
                animate={{ rotate: running ? 360 : 0 }}
                transition={{ duration: 1.4, repeat: running ? Infinity : 0, ease: "linear" }}
              >
                <HugeiconsIcon
                  icon={done ? CheckmarkCircle02Icon : failed ? AlertCircleIcon : scriptReady ? File01Icon : Loading03Icon}
                  size={24}
                />
              </motion.span>
            </div>

            <h1 className="font-heading mt-5 text-3xl font-semibold tracking-tight">
              {done ? "Your Luminar is ready!" :
               failed ? "Generation failed" :
               scriptReady ? "Script is ready to review" :
               phase === 2 ? "Generating your luminar…" :
               "Writing your script…"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {done ? "Taking you to the player…" :
               failed ? (wsMessage || "Something went wrong. You can retry.") :
               scriptReady ? "Redirecting to script review…" :
               wsMessage || (isPhase1 ? "Extracting content, planning scenes, writing script." : "Animating, recording audio, building quizzes.")}
            </p>
          </motion.div>

          {!failed && !scriptReady && (
            <div className="w-full">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Phase {phase}: {isPhase1 ? "Script" : "Luminar"}
                </span>
                <span className="font-mono">{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )}

          <PipelineSteps steps={steps} progress={pct} />

          {done && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Button asChild size="lg" className="gap-2 rounded-full px-6">
                <Link to="/watch/$luminarId" params={{ luminarId: jobId }}>
                  <HugeiconsIcon icon={SparklesIcon} size={16} />
                  Open Luminar
                  <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
                </Link>
              </Button>
            </motion.div>
          )}
          {failed && (
            <div className="flex items-center gap-3">
              <Button onClick={handleRetry} disabled={retrying} className="gap-2 rounded-full px-6">
                <HugeiconsIcon
                  icon={retrying ? Loading03Icon : ArrowRight02Icon}
                  size={16}
                  className={cn(retrying && "animate-spin")}
                />
                {retrying ? "Retrying…" : "Retry generation"}
              </Button>
              <Button asChild variant="outline">
                <Link to="/create">Start over</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PipelineSteps({ steps, progress }: {
  steps: ReadonlyArray<{ label: string; floor: number }>
  progress: number
}) {
  return (
    <div className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((s, i) => {
        const prevFloor = steps[i - 1]?.floor ?? 0
        const complete = progress >= s.floor
        const active = !complete && progress >= prevFloor
        return (
          <div
            key={s.label}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              complete && "border-primary/50 bg-primary/5",
              active && "border-foreground/30 bg-foreground/5",
            )}
          >
            <div className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</div>
            <div className={cn("mt-1 text-xs font-medium", complete && "text-primary")}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}
