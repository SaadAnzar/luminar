import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Logo } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { TOKEN_KEY, USER_KEY, type AuthUser } from "@/hooks/AuthContext"

export const Route = createFileRoute("/onboarding")({
  beforeLoad: () => {
    if (!localStorage.getItem(TOKEN_KEY)) throw redirect({ to: "/signin" })
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY) || "null")
      if (u?.onboarded) throw redirect({ to: "/home" })
    } catch { /* fall through to onboarding */ }
  },
  component: OnboardingPage,
})

const INTERESTS = ["Machine Learning", "Programming", "Mathematics", "Science", "History", "Business", "Design", "Languages", "Health", "Finance", "Philosophy", "Economics"]
const GOALS = ["Exam prep", "Career growth", "Pure curiosity", "A work project", "Teaching others"]
const LEVELS = [
  { v: "beginner", label: "Beginner", sub: "New to most topics" },
  { v: "intermediate", label: "Intermediate", sub: "Comfortable with basics" },
  { v: "advanced", label: "Advanced", sub: "Want depth & nuance" },
]
const STYLES = [
  { v: "concise", label: "Concise", sub: "Get to the point" },
  { v: "balanced", label: "Balanced", sub: "A bit of both" },
  { v: "in_depth", label: "In-depth", sub: "Thorough & detailed" },
]

function OnboardingPage() {
  const nav = useNavigate()
  const { user, updateUser } = useAuth()
  const [interests, setInterests] = useState<string[]>([])
  const [custom, setCustom] = useState("")
  const [goals, setGoals] = useState<string[]>([])
  const [level, setLevel] = useState("")
  const [style, setStyle] = useState("balanced")
  const [saving, setSaving] = useState(false)

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const addCustom = () => {
    const v = custom.trim()
    if (v && !interests.includes(v)) setInterests([...interests, v])
    setCustom("")
  }

  async function finish() {
    if (interests.length === 0) { toast.error("Pick at least one interest"); return }
    if (!level) { toast.error("Select your level"); return }
    setSaving(true)
    try {
      await authApi.updateProfile({ interests, goals, skill_level: level, learning_style: style, onboarded: true })
      if (user) updateUser({ ...user, interests, goals, skill_level: level, learning_style: style, onboarded: true } as AuthUser)
      toast.success("You're all set!")
      nav({ to: "/home" })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="bg-grid mask-fade-b absolute inset-0 -z-10 opacity-[0.3]" />
      <div className="glow-primary absolute inset-x-0 top-0 -z-10 h-[420px]" />
      <div className="mx-auto flex min-h-svh max-w-2xl flex-col px-6 py-10">
        <Logo />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 flex-col justify-center py-8"
        >
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            Let's tailor Luminar to you
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            A few quick choices so every luminar fits how you learn. You can change these anytime.
          </p>

          {/* Interests */}
          <Section title="What are you into?" hint="Pick a few — we'll tailor examples and suggestions.">
            <div className="flex flex-wrap gap-2">
              {[...INTERESTS, ...interests.filter((i) => !INTERESTS.includes(i))].map((t) => (
                <Chip key={t} active={interests.includes(t)} onClick={() => toggle(interests, setInterests, t)}>{t}</Chip>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own…"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom() } }} className="h-9 max-w-xs" />
              <Button type="button" variant="outline" size="sm" onClick={addCustom} disabled={!custom.trim()}>Add</Button>
            </div>
          </Section>

          {/* Level */}
          <Section title="How would you rate your level?">
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVELS.map((l) => <Choice key={l.v} active={level === l.v} onClick={() => setLevel(l.v)} {...l} />)}
            </div>
          </Section>

          {/* Goals */}
          <Section title="What brings you here?" hint="Optional — shapes how lessons are framed.">
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => <Chip key={g} active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)}>{g}</Chip>)}
            </div>
          </Section>

          {/* Style */}
          <Section title="Preferred explanation style">
            <div className="grid gap-2 sm:grid-cols-3">
              {STYLES.map((s) => <Choice key={s.v} active={style === s.v} onClick={() => setStyle(s.v)} {...s} />)}
            </div>
          </Section>

          <Button onClick={finish} disabled={saving} size="lg" className="mt-8 gap-2 self-start rounded-full px-7">
            {saving ? "Saving…" : "Start learning"}
            <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-muted-foreground mb-3 mt-0.5 text-xs">{hint}</p>}
      <div className={cn(!hint && "mt-3")}>{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-all",
        active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}>
      {children}
    </button>
  )
}

function Choice({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "edge-light relative rounded-xl border p-3.5 text-left transition-all",
        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
      )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {active && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-primary" />}
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
    </button>
  )
}
