import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  SparklesIcon,
  CheckmarkCircle02Icon,
  ArrowRight02Icon,
  AlertCircleIcon,
  Loading03Icon,
  GlobalIcon,
} from "@hugeicons/core-free-icons"
import { useAuth } from "@/hooks/useAuth"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatPanel } from "@/components/player/ChatPanel"
import { EngagementBar } from "@/components/player/EngagementBar"
import { ExportVideoButton } from "@/components/player/ExportVideoButton"
import { SceneRenderer } from "@/components/player/SceneRenderer"
import { PlayerControls } from "@/components/player/PlayerControls"
import { QuizOverlay } from "@/components/player/QuizOverlay"
import { CaptionOverlay } from "@/components/player/CaptionOverlay"
import { luminarApi, quizApi } from "@/lib/api"
import type { Scene, QuizCard } from "@/lib/schemas"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/watch/$luminarId")({
  component: WatchPage,
})

function WatchPage() {
  const { luminarId } = Route.useParams()

  const { data: luminar, isLoading: loadingLuminar } = useQuery({
    queryKey: ["luminar", luminarId],
    queryFn: () => luminarApi.get(luminarId),
  })

  const { data: scenes = [], isLoading: loadingScenes } = useQuery({
    queryKey: ["scenes", luminarId],
    queryFn: () => luminarApi.getScenes(luminarId),
    enabled: !!luminar && luminar.status === "ready",
  })

  const { data: quizCards = [] } = useQuery({
    queryKey: ["quiz-cards", luminarId],
    queryFn: () => quizApi.getCards(luminarId),
    enabled: !!luminar && luminar.status === "ready",
  })

  const { user } = useAuth()
  const qc = useQueryClient()
  const isOwner = !!luminar && user?.id === luminar.user_id
  const publishMut = useMutation({
    mutationFn: (published: boolean) => luminarApi.setPublished(luminarId, published),
    onSuccess: (d) => {
      qc.setQueryData(["luminar", luminarId], (old: typeof luminar) => old ? { ...old, published: d.published } : old)
      qc.invalidateQueries({ queryKey: ["discover"] })
      toast.success(d.published ? "Published to Discover" : "Removed from Discover")
    },
    onError: () => toast.error("Could not update publish status"),
  })

  const [sceneIndex, setSceneIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [finished, setFinished] = useState(false)
  const [rightPanel, setRightPanel] = useState<"chat" | "notes">("chat")
  const [activeQuizCard, setActiveQuizCard] = useState<QuizCard | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const shownQuizIds = useRef(new Set<string>())
  const sceneEndedRef = useRef(false) // guards against double scene-end firing

  const SPEEDS = [1, 1.25, 1.5, 2, 0.75]
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length] ?? 1)

  const scene: Scene | null = scenes[sceneIndex] ?? null
  const duration = scene?.duration_ms ?? 0

  const sceneStartTimes = useMemo(
    () =>
      scenes.map((_, i) =>
        scenes.slice(0, i).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0)
      ),
    [scenes]
  )

  const totalDuration = useMemo(() => scenes.reduce((a, s) => a + (s.duration_ms ?? 0), 0), [scenes])
  const totalPositionMs = (sceneStartTimes[sceneIndex] ?? 0) + positionMs

  // Sorted by trigger_at_ms so we check in order
  const sortedQuizCards = useMemo(
    () => [...quizCards].sort((a, b) => (a.trigger_at_ms ?? 0) - (b.trigger_at_ms ?? 0)),
    [quizCards]
  )

  // Timeline annotations: interior scene boundaries + quiz checkpoints
  const chapters = useMemo(() => sceneStartTimes.slice(1).filter((t) => t > 0), [sceneStartTimes])
  const quizMarkers = useMemo(
    () => sortedQuizCards.map((c) => c.trigger_at_ms).filter((t): t is number => t != null),
    [sortedQuizCards]
  )

  const showQuiz = (card: QuizCard) => { setPlaying(false); setActiveQuizCard(card) }

  // Precise mid-scene trigger: pop a quiz the moment playback passes its timestamp.
  const checkDueQuiz = (totalMs: number) => {
    const due = sortedQuizCards.find(
      (c) => c.trigger_at_ms != null && totalMs >= c.trigger_at_ms && !shownQuizIds.current.has(c.id),
    )
    if (due) showQuiz(due)
  }

  // Scene boundary: show this scene's pending quiz, else advance + autoplay.
  // Gated by scene ownership (robust to estimated-vs-actual duration drift).
  const endOfSceneRef = useRef<() => void>(() => {})
  useEffect(() => {
    endOfSceneRef.current = () => {
      const sceneEnd = (sceneStartTimes[sceneIndex] ?? 0) + (scene?.duration_ms ?? 0)
      const pending = sortedQuizCards.find(
        (c) =>
          !shownQuizIds.current.has(c.id) &&
          (c.scene_id === scene?.id || (c.trigger_at_ms != null && c.trigger_at_ms <= sceneEnd + 1500)),
      )
      if (pending) showQuiz(pending)
      else goNext()
    }
  })

  function goNext() {
    if (sceneIndex < scenes.length - 1) {
      setSceneIndex((i) => i + 1)
      setPlaying(true)
    } else {
      setPlaying(false)
      setFinished(true)
    }
  }

  function goPrev() {
    setFinished(false)
    setSceneIndex((i) => Math.max(0, i - 1))
    setPlaying(true)
  }

  function replay() {
    shownQuizIds.current.clear()
    setFinished(false)
    setPositionMs(0)
    setSceneIndex(0)
    setPlaying(true)
  }

  // Reset playback-derived state when the active scene changes.
  useEffect(() => {
    sceneEndedRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPositionMs(0)
    setActiveQuizCard(null)
  }, [sceneIndex])

  // Start/stop the scene's audio on scene change.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = 0
    if (playing) a.play().catch(() => setPlaying(false))
    else a.pause()
  }, [sceneIndex]) // eslint-disable-line

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.play().catch(() => setPlaying(false))
    else a.pause()
  }, [playing])

  // Ticker (80ms): advances position, fires due quizzes, and detects scene end.
  useEffect(() => {
    if (!playing || activeQuizCard) return
    const a = audioRef.current
    const start = sceneStartTimes[sceneIndex] ?? 0
    const dur = duration

    const atEnd = (pos: number) => !sceneEndedRef.current && ((a?.ended ?? false) || (dur > 0 && pos >= dur - 150))

    if (a && scene?.audio_url) {
      const id = setInterval(() => {
        const pos = Math.round(a.currentTime * 1000)
        setPositionMs(pos)
        checkDueQuiz(start + pos)
        if (atEnd(pos)) {
          sceneEndedRef.current = true
          clearInterval(id)
          endOfSceneRef.current()
        }
      }, 80)
      return () => clearInterval(id)
    }

    if (dur <= 0) return
    const t0 = performance.now()
    const p0 = positionMs
    const id = setInterval(() => {
      const next = Math.round(p0 + (performance.now() - t0))
      checkDueQuiz(start + next)
      if (next >= dur) {
        setPositionMs(dur)
        clearInterval(id)
        if (!sceneEndedRef.current) { sceneEndedRef.current = true; endOfSceneRef.current() }
      } else {
        setPositionMs(next)
      }
    }, 80)
    return () => clearInterval(id)
  }, [playing, sceneIndex, activeQuizCard]) // eslint-disable-line

  // Sync volume / mute / playback speed to the audio element
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
    a.muted = muted
    a.playbackRate = speed
  }, [volume, muted, speed, sceneIndex])

  // Track fullscreen state
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  function toggleFullscreen() {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen().catch(() => {})
  }

  // Keyboard shortcuts: space=play/pause, ←/→=scene, m=mute, f=fullscreen, c=captions
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeQuizCard) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.code === "Space") {
        e.preventDefault()
        if (finished) replay()
        else setPlaying((p) => !p)
      } else if (e.code === "ArrowRight") {
        e.preventDefault(); goNext()
      } else if (e.code === "ArrowLeft") {
        e.preventDefault(); goPrev()
      } else if (e.key.toLowerCase() === "m") {
        setMuted((m) => !m)
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen()
      } else if (e.key.toLowerCase() === "c") {
        setCaptionsOn((c) => !c)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeQuizCard, finished, sceneIndex, scenes.length]) // eslint-disable-line

  function handleTotalSeek(totalMs: number) {
    let idx = 0
    for (let i = 0; i < scenes.length; i++) {
      if (totalMs < (sceneStartTimes[i + 1] ?? Infinity)) { idx = i; break }
    }
    const offset = totalMs - (sceneStartTimes[idx] ?? 0)
    if (idx !== sceneIndex) {
      setSceneIndex(idx)
      setPositionMs(offset)
    } else {
      setPositionMs(offset)
      const a = audioRef.current
      if (a) a.currentTime = offset / 1000
    }
  }

  function onQuizComplete() {
    if (activeQuizCard) shownQuizIds.current.add(activeQuizCard.id)
    // If this scene has another unshown quiz, chain it; otherwise advance + autoplay.
    const more = sortedQuizCards.find((c) => !shownQuizIds.current.has(c.id) && c.scene_id === scene?.id)
    if (more) {
      setActiveQuizCard(more)
    } else {
      setActiveQuizCard(null)
      goNext()
    }
  }

  const isLoading = loadingLuminar || loadingScenes
  if (isLoading) return <WatchSkeleton />
  if (!luminar) return null
  if (luminar.status !== "ready") return <NotReadyState luminarId={luminarId} status={luminar.status} title={luminar.title} />

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="size-9" aria-label="Back">
          <Link to="/home">
            <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">{luminar.title}</h1>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="rounded-full font-normal">{luminar.prompt}</Badge>
            {luminar.difficulty_hint !== "medium" && (
              <Badge variant="outline" className={cn(
                "rounded-full font-normal",
                luminar.difficulty_hint === "easy" ? "text-emerald-600 border-emerald-300" : "text-rose-600 border-rose-300"
              )}>
                {luminar.difficulty_hint}
              </Badge>
            )}
            <span>·</span>
            <span>{scenes.length} scenes</span>
            <span>·</span>
            <span>{luminar.duration_minutes} min</span>
          </div>
        </div>

        <div className="flex-1" />

        <EngagementBar luminarId={luminarId} />
        <ExportVideoButton title={luminar.title} scenes={scenes} />

        {isOwner && (
          <Button
            variant={luminar.published ? "secondary" : "default"}
            size="sm"
            className="gap-1.5 rounded-full"
            disabled={publishMut.isPending}
            onClick={() => publishMut.mutate(!luminar.published)}
          >
            <HugeiconsIcon icon={GlobalIcon} size={14} />
            {luminar.published ? "Published" : "Publish"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div ref={stageRef} className="bg-card text-card-foreground relative overflow-hidden rounded-xl border p-0">
            <SceneRenderer scene={scene} sceneIndex={sceneIndex} />

            {captionsOn && <CaptionOverlay segments={scene?.caption_segments} positionMs={positionMs} />}

            {scene?.audio_url && (
              <audio key={scene.id} ref={audioRef} src={scene.audio_url} muted={muted} preload="auto" />
            )}

            <PlayerControls
              playing={playing}
              onPlayToggle={() => setPlaying((p) => !p)}
              onPrev={goPrev}
              onNext={goNext}
              position={totalPositionMs}
              duration={totalDuration}
              onSeek={handleTotalSeek}
              muted={muted}
              onMuteToggle={() => setMuted((m) => !m)}
              volume={volume}
              onVolumeChange={(v) => { setVolume(v); if (v > 0) setMuted(false) }}
              speed={speed}
              onCycleSpeed={cycleSpeed}
              captionsOn={captionsOn}
              onCaptionsToggle={() => setCaptionsOn((c) => !c)}
              onFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              canGoPrev={sceneIndex > 0}
              canGoNext={sceneIndex < scenes.length - 1}
              chapters={chapters}
              quizMarkers={quizMarkers}
            />

            <AnimatePresence>
              {activeQuizCard && (
                <QuizOverlay card={activeQuizCard} onComplete={onQuizComplete} />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {finished && !activeQuizCard && (
                <CompletionOverlay
                  nextTopics={luminar.suggested_next_topics ?? []}
                  onReplay={replay}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <aside className="flex min-h-[560px] flex-col lg:h-[calc(100svh-7rem)]">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-card p-1 text-sm">
            <button
              onClick={() => setRightPanel("chat")}
              className={cn("rounded-lg py-1.5 font-medium transition-colors", rightPanel === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Tutor chat
            </button>
            <button
              onClick={() => setRightPanel("notes")}
              className={cn("rounded-lg py-1.5 font-medium transition-colors", rightPanel === "notes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Lesson
            </button>
          </div>

          {rightPanel === "chat" ? (
            <Card className="flex-1 overflow-hidden p-0">
              <ChatPanel luminarId={luminarId} title={luminar.title} />
            </Card>
          ) : (
          <Tabs defaultValue="narration" className="flex h-full flex-1 flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="narration">Script</TabsTrigger>
              <TabsTrigger value="all-scenes">Scenes</TabsTrigger>
              <TabsTrigger value="concepts">Concepts</TabsTrigger>
            </TabsList>
            <Card className="mt-4 flex-1 overflow-hidden">
              <TabsContent value="narration" className="m-0 h-full">
                <ScrollArea className="h-full p-5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {scene?.narration_text
                      ? scene.narration_text.replace(/\[VISUAL_CUE:[^\]]*\]/g, "").trim()
                      : "—"}
                  </p>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="all-scenes" className="m-0 h-full">
                <ScrollArea className="h-full p-3">
                  <div className="space-y-1">
                    {scenes.map((s, i) => {
                      const hasQuiz = sortedQuizCards.some((c) => c.scene_id === s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSceneIndex(i); setPositionMs(0); setFinished(false); setPlaying(true) }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            i === sceneIndex ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                          )}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                          <span className="flex-1 truncate">{s.title ?? `Scene ${i + 1}`}</span>
                          {hasQuiz && (
                            <span className="bg-amber-500/15 text-amber-600 rounded px-1 text-[9px] font-medium">Q</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="concepts" className="m-0 h-full">
                <ScrollArea className="h-full p-4">
                  {luminar.key_concepts?.length ? (
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key concepts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {luminar.key_concepts.map((c) => (
                          <span key={c} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{c}</span>
                        ))}
                      </div>
                      {luminar.suggested_next_topics?.length && (
                        <>
                          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Explore next</p>
                          <div className="flex flex-wrap gap-1.5">
                            {luminar.suggested_next_topics.map((t) => (
                              <span key={t} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{t}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Card>
          </Tabs>
          )}
        </aside>
      </div>
    </div>
  )
}

function CompletionOverlay({ nextTopics, onReplay }: { nextTopics: string[]; onReplay: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-background/85 absolute inset-0 z-20 flex items-center justify-center p-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-card ring-border w-full max-w-md rounded-2xl p-7 text-center shadow-xl ring-1"
      >
        <div className="bg-emerald-500/10 text-emerald-600 mx-auto flex size-12 items-center justify-center rounded-2xl">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={26} />
        </div>
        <h3 className="font-heading mt-4 text-xl font-semibold tracking-tight">Luminar complete</h3>
        <p className="text-muted-foreground mt-1 text-sm">Nice work. Your mastery has been updated.</p>

        {nextTopics.length > 0 && (
          <div className="mt-5 text-left">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Explore next</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {nextTopics.map((t) => (
                <Link
                  key={t}
                  to="/create"
                  className="border-border hover:border-primary/40 hover:text-foreground text-muted-foreground rounded-full border px-2.5 py-1 text-xs transition-colors"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={onReplay} variant="outline" className="gap-2">
            <HugeiconsIcon icon={SparklesIcon} size={15} />
            Replay
          </Button>
          <Button asChild className="gap-2">
            <Link to="/home">
              Back to home
              <HugeiconsIcon icon={ArrowRight02Icon} size={15} />
            </Link>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function NotReadyState({ luminarId, status, title }: { luminarId: string; status: string; title: string }) {
  const failed = status === "failed"
  return (
    <div className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className={cn(
        "flex size-12 items-center justify-center rounded-2xl",
        failed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
      )}>
        <motion.span
          animate={{ rotate: failed ? 0 : 360 }}
          transition={{ duration: 1.4, repeat: failed ? 0 : Infinity, ease: "linear" }}
        >
          <HugeiconsIcon icon={failed ? AlertCircleIcon : Loading03Icon} size={24} />
        </motion.span>
      </div>
      <h1 className="font-heading mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        {failed ? "This luminar failed to generate." : "This luminar is still being generated."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/generating/$jobId" params={{ jobId: luminarId }}>
          {failed ? "View & retry" : "View progress"}
        </Link>
      </Button>
    </div>
  )
}

function WatchSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <Skeleton className="h-8 w-80" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <Skeleton className="min-h-[540px] w-full rounded-xl" />
      </div>
    </div>
  )
}
