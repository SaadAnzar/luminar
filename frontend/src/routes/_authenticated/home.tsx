import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  SparklesIcon,
  BookOpen01Icon,
  Bookmark01Icon,
  PlayListIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LuminarCard } from "@/components/luminar/LuminarCard"
import { FadeIn } from "@/components/motion/FadeIn"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { luminarApi, favoritesApi } from "@/lib/api"
import type { Luminar } from "@/lib/schemas"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
})

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: typeof SparklesIcon
  label: string
  value: number
  tint: string
}) {
  return (
    <div className="edge-light flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-xl",
          tint
        )}
      >
        <HugeiconsIcon icon={icon} size={18} />
      </div>
      <div>
        <div className="font-heading text-2xl leading-none font-bold tracking-tight">
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={SparklesIcon} size={26} />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      <Button asChild size="sm" className="gap-1.5 rounded-full">
        <Link to="/create">
          Create a luminar
          <HugeiconsIcon icon={ArrowRight02Icon} size={15} />
        </Link>
      </Button>
    </div>
  )
}

function CardGrid({
  luminars,
  isLoading,
  emptyText,
  favoriteIds,
  onFavoriteToggle,
}: {
  luminars: Luminar[]
  isLoading: boolean
  emptyText: string
  favoriteIds: Set<string>
  onFavoriteToggle: (id: string, current: boolean) => void
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    )
  }
  if (!luminars.length) return <EmptyState text={emptyText} />
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {luminars.map((v) => (
        <StaggerItem key={v.id}>
          <LuminarCard
            luminar={v}
            isFavorited={favoriteIds.has(v.id)}
            onFavoriteToggle={onFavoriteToggle}
          />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

function HomePage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [tab, setTab] = useState("created")

  const { data: allLuminars = [], isLoading: loadingAll } = useQuery({
    queryKey: ["my-luminars"],
    queryFn: () => luminarApi.myLuminars(),
  })
  const { data: favorites = [], isLoading: loadingFavs } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesApi.list(),
  })

  const favoriteIds = new Set(favorites.map((f) => f.id))
  const readyLuminars = allLuminars.filter((v) => v.status === "ready")
  const draftLuminars = allLuminars.filter((v) => v.status !== "ready")

  const favMutation = useMutation({
    mutationFn: ({ id, current }: { id: string; current: boolean }) =>
      current ? favoritesApi.remove(id) : favoritesApi.add(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
    onError: () => toast.error("Could not update favorites"),
  })
  const handleFavoriteToggle = (id: string, current: boolean) =>
    favMutation.mutate({ id, current })

  const firstName = user?.name?.split(" ")[0] ?? "there"

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Welcome band */}
      <FadeIn>
        <div className="glow-primary edge-light relative mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card p-7 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
                Welcome back, {firstName} 👋
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Your AI-generated lessons, all in one place. Pick up where you
                left off — or start something new.
              </p>
            </div>
            <Button asChild size="lg" className="gap-2 rounded-full px-6 shadow-lg shadow-primary/20">
              <Link to="/create"><HugeiconsIcon icon={Add01Icon} size={17} />New luminar</Link>
            </Button>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={PlayListIcon}
              label="Total luminars"
              value={allLuminars.length}
              tint="bg-primary/10 text-primary"
            />
            <StatCard
              icon={CheckmarkCircle02Icon}
              label="Completed"
              value={readyLuminars.length}
              tint="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard
              icon={Loading03Icon}
              label="In progress"
              value={draftLuminars.length}
              tint="bg-amber-500/10 text-amber-500"
            />
            <StatCard
              icon={Bookmark01Icon}
              label="Favourites"
              value={favorites.length}
              tint="bg-rose-500/10 text-rose-500"
            />
          </div>
        </div>
      </FadeIn>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="created" className="gap-2">
            <HugeiconsIcon icon={SparklesIcon} size={14} />
            Library
            {readyLuminars.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {readyLuminars.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2">
            <HugeiconsIcon icon={BookOpen01Icon} size={14} />
            In progress
            {draftLuminars.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                {draftLuminars.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="favourited" className="gap-2">
            <HugeiconsIcon icon={Bookmark01Icon} size={14} />
            Favourites
            {favorites.length > 0 && (
              <span className="ml-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">
                {favorites.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created">
          <CardGrid
            luminars={readyLuminars}
            isLoading={loadingAll}
            emptyText="No finished luminars yet. Create your first lesson and it'll appear here."
            favoriteIds={favoriteIds}
            onFavoriteToggle={handleFavoriteToggle}
          />
        </TabsContent>
        <TabsContent value="drafts">
          <CardGrid
            luminars={draftLuminars}
            isLoading={loadingAll}
            emptyText="Nothing in progress. New luminars show here while they generate."
            favoriteIds={favoriteIds}
            onFavoriteToggle={handleFavoriteToggle}
          />
        </TabsContent>
        <TabsContent value="favourited">
          <CardGrid
            luminars={favorites}
            isLoading={loadingFavs}
            emptyText="No favourites yet. Tap the bookmark on any luminar to save it here."
            favoriteIds={favoriteIds}
            onFavoriteToggle={handleFavoriteToggle}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
