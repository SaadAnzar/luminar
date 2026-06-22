import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlayListIcon,
  SparklesIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Clock01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FadeIn } from "@/components/motion/FadeIn"
import { authApi, portfolioApi } from "@/lib/api"
import { initials, cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { type AuthUser } from "@/hooks/AuthContext"

export const Route = createFileRoute("/_authenticated/profile/$userId")({
  component: ProfilePage,
})

function ProfilePage() {
  const { userId } = Route.useParams()
  const { user: me } = useAuth()
  const isMe = me?.id === userId

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => authApi.profile(userId),
  })

  const { data: portfolio, isLoading: loadingPortfolio } = useQuery({
    queryKey: ["portfolio", userId],
    queryFn: () => portfolioApi.get(),
    enabled: isMe,
  })

  if (loadingProfile || !profile) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <FadeIn>
        {/* Profile header */}
        <div className="flex flex-col gap-5 rounded-3xl bg-linear-to-br from-primary/10 via-background to-violet-500/10 p-6 ring-1 ring-border md:flex-row md:items-center md:p-8">
          <Avatar className="size-20 ring-4 ring-background">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>{initials(profile.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{profile.name}</h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Luminars" value={profile.total_luminars} icon={PlayListIcon} />
        <StatCard label="Completed" value={profile.ready_luminars} icon={CheckmarkCircle02Icon} />
        {isMe && portfolio && (
          <StatCard
            label="Overall accuracy"
            value={`${portfolio.overall_accuracy_pct}%`}
            icon={SparklesIcon}
            sub={`${portfolio.total_attempts} attempts`}
          />
        )}
      </div>

      {isMe && <LearningProfileCard />}

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent" className="gap-2">
            <HugeiconsIcon icon={Clock01Icon} size={14} />
            Recent
          </TabsTrigger>
          {isMe && (
            <TabsTrigger value="portfolio" className="gap-2">
              <HugeiconsIcon icon={SparklesIcon} size={14} />
              Portfolio
            </TabsTrigger>
          )}
        </TabsList>

        {/* Recent luminars */}
        <TabsContent value="recent" className="pt-6">
          {profile.recent_luminars.length ? (
            <div className="space-y-2">
              {profile.recent_luminars.map((v) => (
                <Link
                  key={v.id}
                  to={v.status === "ready" ? "/watch/$luminarId" : "/home"}
                  params={v.status === "ready" ? { luminarId: v.id } : undefined}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={PlayListIcon} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.duration_minutes} min</p>
                  </div>
                  <Badge variant={v.status === "ready" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                    {v.status === "ready" ? "Ready" : v.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No lessons yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Portfolio */}
        {isMe && (
          <TabsContent value="portfolio" className="pt-6">
            {loadingPortfolio ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : !portfolio || portfolio.by_luminar.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">Complete some quizzes to build your portfolio.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Overall summary */}
                <Card className="mb-4">
                  <CardContent className="flex items-center gap-6 p-5">
                    <div className="text-center">
                      <p className="font-heading text-3xl font-bold">{portfolio.overall_accuracy_pct}%</p>
                      <p className="text-xs text-muted-foreground">Overall accuracy</p>
                    </div>
                    <div className="flex-1">
                      <Progress value={portfolio.overall_accuracy_pct} className="h-2" />
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>{portfolio.total_correct} correct</span>
                        <span>{portfolio.total_attempts} total</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Per-luminar breakdown */}
                {portfolio.by_luminar.map((stat) => (
                  <Card key={stat.luminar_id}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{stat.luminar_title ?? "Untitled"}</p>
                        <span className={`text-sm font-bold ${stat.accuracy_pct >= 70 ? "text-emerald-600" : stat.accuracy_pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                          {stat.accuracy_pct}%
                        </span>
                      </div>
                      <Progress value={stat.accuracy_pct} className="h-1.5" />
                      <div className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                        <span>{stat.correct}/{stat.total_attempts} correct</span>
                        {stat.hint_uses > 0 && (
                          <span className="flex items-center gap-0.5">
                            <HugeiconsIcon icon={InformationCircleIcon} size={10} />
                            {stat.hint_uses} hints used
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string
  value: number | string
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <HugeiconsIcon icon={icon} size={12} />
          {label}
        </div>
        <div className="mt-2 font-heading text-3xl font-bold tracking-tight">{value}</div>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

const INTERESTS = ["Machine Learning", "Programming", "Mathematics", "Science", "History", "Business", "Design", "Languages", "Health", "Finance", "Philosophy", "Economics"]
const GOALS = ["Exam prep", "Career growth", "Pure curiosity", "A work project", "Teaching others"]
const LEVELS = ["beginner", "intermediate", "advanced"]
const STYLES = ["concise", "balanced", "in_depth"]

function LearningProfileCard() {
  const { user, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [interests, setInterests] = useState<string[]>(user?.interests ?? [])
  const [goals, setGoals] = useState<string[]>(user?.goals ?? [])
  const [level, setLevel] = useState(user?.skill_level ?? "")
  const [style, setStyle] = useState(user?.learning_style ?? "balanced")
  const [saving, setSaving] = useState(false)

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  async function save() {
    setSaving(true)
    try {
      await authApi.updateProfile({ interests, goals, skill_level: level, learning_style: style })
      if (user) updateUser({ ...user, interests, goals, skill_level: level, learning_style: style } as AuthUser)
      toast.success("Profile updated")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const chips = (user?.interests ?? []).concat(user?.goals ?? [])

  return (
    <Card className="edge-light">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Learning profile</h2>
            <p className="text-muted-foreground text-xs">Tailors how your luminars are written.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><HugeiconsIcon icon={PencilEdit02Icon} size={14} />Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85svh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit learning profile</DialogTitle></DialogHeader>
              <div className="space-y-5 py-1">
                <Field label="Interests">
                  <div className="flex flex-wrap gap-2">
                    {[...INTERESTS, ...interests.filter((i) => !INTERESTS.includes(i))].map((t) => (
                      <Pill key={t} active={interests.includes(t)} onClick={() => toggle(interests, setInterests, t)}>{t}</Pill>
                    ))}
                  </div>
                </Field>
                <Field label="Level">
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((l) => <Pill key={l} active={level === l} onClick={() => setLevel(l)}>{l}</Pill>)}
                  </div>
                </Field>
                <Field label="Goals">
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map((g) => <Pill key={g} active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)}>{g}</Pill>)}
                  </div>
                </Field>
                <Field label="Style">
                  <div className="flex flex-wrap gap-2">
                    {STYLES.map((s) => <Pill key={s} active={style === s} onClick={() => setStyle(s)}>{s.replace("_", "-")}</Pill>)}
                  </div>
                </Field>
              </div>
              <DialogFooter>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {user?.skill_level && <Badge variant="secondary" className="rounded-full capitalize">{user.skill_level}</Badge>}
          {chips.length ? chips.map((c) => (
            <span key={c} className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">{c}</span>
          )) : <span className="text-muted-foreground text-xs">No interests set yet — add some to tailor your luminars.</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs capitalize transition-all",
        active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
      {children}
    </button>
  )
}
