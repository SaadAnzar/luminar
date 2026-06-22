import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  SparklesIcon,
  BrainIcon,
  RocketIcon,
  File01Icon,
  FileAddIcon,
  PresentationBarChart01Icon,
  GlobalIcon,
  CheckmarkCircle02Icon,
  PlayIcon,
  BulbIcon,
} from "@hugeicons/core-free-icons"
import { Logo } from "@/components/layout/Logo"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { FadeIn } from "@/components/motion/FadeIn"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (localStorage.getItem("luminar_token")) throw redirect({ to: "/home" })
  },
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-svh overflow-x-hidden">
      <SiteHeader />
      <Hero />
      <SourceStrip />
      <Bento />
      <HowItWorks />
      <GamifyStrip />
      <CTA />
      <SiteFooter />
    </div>
  )
}

/* ── Header ─────────────────────────────────────────────────────────── */
function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="Luminar home"><Logo /></Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="size-9" />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5 rounded-full">
            <Link to="/signin">Get started<HugeiconsIcon icon={ArrowRight02Icon} size={15} /></Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

/* ── Hero ───────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* layered backdrop: grid + brand glow + soft mesh blobs */}
      <div className="bg-grid mask-fade-b absolute inset-0 -z-10 opacity-[0.3]" />
      <div className="glow-primary absolute inset-x-0 top-0 -z-10 h-[560px]" />
      <div className="absolute -left-32 top-24 -z-10 size-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute -right-32 top-40 -z-10 size-96 rounded-full bg-violet-500/15 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 md:pt-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            Multi-agent AI lesson studio
          </span>

          <h1 className="font-heading mx-auto max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl md:text-6xl">
            Turn anything into a
            <span className="from-primary via-primary to-violet-500 bg-gradient-to-r bg-clip-text text-transparent"> lesson you'll finish</span>.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-lg text-balance">
            Drop a topic, document, or link. Luminar's agents write the script,
            animate every scene, narrate it, and quiz you — in minutes.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2 rounded-full px-7 text-base shadow-lg shadow-primary/20">
              <Link to="/signin">Create your first luminar<HugeiconsIcon icon={ArrowRight02Icon} size={17} /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 rounded-full px-6 text-base">
              <Link to="/signin"><HugeiconsIcon icon={PlayIcon} size={15} />Watch a demo</Link>
            </Button>
          </div>
          <p className="text-muted-foreground/70 mt-4 text-xs">Free to start · No credit card</p>
        </motion.div>

        <PlayerMock />
      </div>
    </section>
  )
}

/* A realistic product shot of the luminar player. */
function PlayerMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto mt-16 max-w-4xl"
    >
      <div className="edge-light bg-card ring-border/70 relative overflow-hidden rounded-3xl shadow-2xl ring-1">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-400/70" />
            <div className="size-3 rounded-full bg-amber-400/70" />
            <div className="size-3 rounded-full bg-emerald-400/70" />
          </div>
          <div className="ml-2 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            Scene 2 of 4 · How attention works
          </div>
        </div>

        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-primary/[0.07] to-violet-500/[0.04]">
          <SceneArt />
          {/* caption */}
          <div className="absolute inset-x-0 bottom-16 flex justify-center px-6">
            <div className="rounded-md bg-black/75 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              Each token learns to look at every other token
            </div>
          </div>
          {/* chaptered scrubber */}
          <div className="glass absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2">
            <div className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
              <HugeiconsIcon icon={PlayIcon} size={13} />
            </div>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/15">
              <div className="h-full w-[42%] rounded-full bg-primary" />
              {/* scene ticks + quiz dots */}
              <span className="absolute left-[25%] top-1/2 h-2 w-px -translate-y-1/2 bg-background/80" />
              <span className="absolute left-[50%] top-1/2 h-2 w-px -translate-y-1/2 bg-background/80" />
              <span className="absolute left-[75%] top-1/2 h-2 w-px -translate-y-1/2 bg-background/80" />
            </div>
            <span className="size-2 rounded-full bg-amber-400 ring-2 ring-card" title="Quiz checkpoint" />
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">1:04 / 2:30</span>
          </div>
        </div>
      </div>

      {/* floating quiz card for depth */}
      <motion.div
        initial={{ opacity: 0, y: 18, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="absolute -bottom-8 -right-4 hidden w-60 sm:block"
      >
        <MiniQuiz />
      </motion.div>
      <div className="from-background pointer-events-none absolute inset-x-0 -bottom-12 h-32 bg-gradient-to-t to-transparent" />
    </motion.div>
  )
}

function SceneArt() {
  return (
    <svg viewBox="0 0 800 450" className="h-full w-full">
      <defs>
        <linearGradient id="sa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#sa)" />
      {[...Array(5)].map((_, i) => (
        <motion.circle
          key={i} cx={150 + i * 125} cy={200} r={30}
          fill="var(--primary)" fillOpacity={0.2 + i * 0.13}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1, 1, 0], y: [0, -16, 0, 0] }}
          transition={{ duration: 3.4, delay: i * 0.22, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <motion.path
          key={i} d={`M ${150 + i * 125} 200 L ${275 + i * 125} 200`}
          stroke="var(--primary)" strokeWidth={2} fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 1, 1, 0], opacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: 3.4, delay: 0.3 + i * 0.22, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </svg>
  )
}

function MiniQuiz() {
  return (
    <div className="edge-light rounded-2xl border border-border/70 bg-card p-4 shadow-xl">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <HugeiconsIcon icon={SparklesIcon} size={11} className="text-primary" /> Quick check
      </div>
      <p className="text-[13px] font-semibold leading-snug">What does attention compute?</p>
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-[11px]">
          <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-[9px] text-white">A</span>
          Weighted token relationships
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} className="ml-auto text-emerald-600" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span className="grid size-4 place-items-center rounded-full bg-muted text-[9px]">B</span>
          Pixel gradients
        </div>
      </div>
    </div>
  )
}

/* ── Source strip ───────────────────────────────────────────────────── */
const sources = [
  { icon: SparklesIcon, label: "Topic" },
  { icon: File01Icon, label: "PDF" },
  { icon: FileAddIcon, label: "Word" },
  { icon: PresentationBarChart01Icon, label: "Slides" },
  { icon: GlobalIcon, label: "Website" },
  { icon: PlayIcon, label: "YouTube" },
]
function SourceStrip() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 py-9">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Learns from anything you bring</p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {sources.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-sm">
              <HugeiconsIcon icon={s.icon} size={14} className="text-primary" />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Bento ──────────────────────────────────────────────────────────── */
function Bento() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <FadeIn className="mb-12 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Not slides. A studio.
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-lg">
          Every luminar is generated end-to-end by agents with taste — and built to make it stick.
        </p>
      </FadeIn>

      <Stagger className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
        {/* big: animated scenes */}
        <StaggerItem className="md:col-span-2 md:row-span-2">
          <BentoCard className="flex h-full flex-col">
            <BentoHead tint="text-primary bg-primary/10" icon={BulbIcon} title="Animated, narrated scenes" body="Each scene is a hand-built animated SVG that tracks the narration — no stock clips, no static slides." />
            <div className="mt-5 flex-1 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/[0.06] to-violet-500/[0.04]">
              <SceneArt />
            </div>
          </BentoCard>
        </StaggerItem>

        {/* quiz-gated */}
        <StaggerItem>
          <BentoCard>
            <BentoHead tint="text-emerald-500 bg-emerald-500/10" icon={CheckmarkCircle02Icon} title="Quiz-gated" body="Checkpoints pop mid-lesson so you actually learn." />
          </BentoCard>
        </StaggerItem>

        {/* adaptive mastery */}
        <StaggerItem>
          <BentoCard>
            <BentoHead tint="text-violet-500 bg-violet-500/10" icon={BrainIcon} title="Adaptive mastery" body="Weak spots shape your next luminar." />
            <div className="mt-4 space-y-2">
              {[["Attention", 82], ["Embeddings", 54], ["Tokenization", 38]].map(([k, v]) => (
                <div key={k as string}>
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{k}</span><span>{v}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>
        </StaggerItem>
      </Stagger>

      {/* secondary row */}
      <Stagger className="mt-4 grid gap-4 md:grid-cols-2">
        <StaggerItem>
          <BentoCard className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><HugeiconsIcon icon={File01Icon} size={20} /></div>
            <div><h3 className="text-base font-semibold tracking-tight">Script-first</h3><p className="text-muted-foreground mt-1 text-sm">Review the full narration before anything renders. Approve, then build.</p></div>
          </BentoCard>
        </StaggerItem>
        <StaggerItem>
          <BentoCard className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><HugeiconsIcon icon={SparklesIcon} size={20} /></div>
            <div><h3 className="text-base font-semibold tracking-tight">Minutes, not hours</h3><p className="text-muted-foreground mt-1 text-sm">A 2–5 minute lesson, fully produced, while you grab a coffee.</p></div>
          </BentoCard>
        </StaggerItem>
      </Stagger>
    </section>
  )
}

function BentoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("group edge-light h-full rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg", className)}>
      {children}
    </div>
  )
}
function BentoHead({ tint, icon, title, body }: { tint: string; icon: typeof SparklesIcon; title: string; body: string }) {
  return (
    <div>
      <div className={cn("mb-4 flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105", tint)}>
        <HugeiconsIcon icon={icon} size={20} />
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

/* ── How it works ───────────────────────────────────────────────────── */
const steps = [
  { title: "Bring a topic + source", body: "Type a prompt, or drop a PDF, doc, slides, a website, or a YouTube link." },
  { title: "Review the script", body: "We write the narration first. Read it, tweak the brief, approve." },
  { title: "Watch, quiz, grow", body: "Animated scenes, captions, and checkpoints — every attempt builds your portfolio." },
]
function HowItWorks() {
  return (
    <section id="how" className="border-y border-border/60 bg-muted/30 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <FadeIn className="mb-12 text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">Three steps, one luminar</h2>
        </FadeIn>
        <div className="relative grid gap-4 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {steps.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.08}>
              <div className="edge-light relative h-full rounded-2xl border border-border/60 bg-card p-6">
                <div className="bg-primary text-primary-foreground font-heading mb-4 flex size-9 items-center justify-center rounded-full text-sm font-bold shadow-lg shadow-primary/20">{i + 1}</div>
                <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{s.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Gamification strip ─────────────────────────────────────────────── */
function GamifyStrip() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Streaks", "Show up daily, keep the flame alive."], ["Mastery", "A score per concept, rising as you nail quizzes."], ["Portfolio", "Every lesson and attempt, tracked over time."]].map(([t, b]) => (
          <FadeIn key={t}><div className="rounded-2xl border border-border/60 bg-card p-6 edge-light">
            <h3 className="font-heading text-xl font-semibold tracking-tight">{t}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm">{b}</p>
          </div></FadeIn>
        ))}
      </div>
    </section>
  )
}

/* ── CTA + Footer ───────────────────────────────────────────────────── */
function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="glow-primary relative overflow-hidden rounded-3xl border border-border/60 bg-card p-10 text-center md:p-16">
        <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl"><HugeiconsIcon icon={RocketIcon} size={28} /></div>
        <h2 className="font-heading mt-6 text-3xl font-semibold tracking-tight text-balance md:text-4xl">Your next lesson is one prompt away.</h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md">Free to start. Bring a topic, we'll bring the studio.</p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="gap-2 rounded-full px-7 text-base shadow-lg shadow-primary/20">
            <Link to="/signin">Get started<HugeiconsIcon icon={ArrowRight02Icon} size={17} /></Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>Learn anything, beautifully.</p>
        <p>© 2026 Luminar</p>
      </div>
    </footer>
  )
}
