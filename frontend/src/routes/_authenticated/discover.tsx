import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, PlayIcon, Compass01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn } from "@/components/motion/FadeIn"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { discoverApi } from "@/lib/api"
import type { DiscoverItem } from "@/lib/schemas"
import { initials } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
})

function DiscoverPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["discover"],
    queryFn: () => discoverApi.feed(),
  })

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <FadeIn className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
          <HugeiconsIcon icon={Compass01Icon} size={22} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Discover</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Luminars published by the community — watch and test yourself.</p>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 py-24 text-center">
          <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
            <HugeiconsIcon icon={SparklesIcon} size={26} />
          </div>
          <p className="text-muted-foreground max-w-xs text-sm">Nothing published yet. Be the first — open one of your luminars and hit Publish.</p>
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((it) => <StaggerItem key={it.id}><DiscoverCard item={it} /></StaggerItem>)}
        </Stagger>
      )}
    </div>
  )
}

function DiscoverCard({ item }: { item: DiscoverItem }) {
  return (
    <Link
      to="/watch/$luminarId"
      params={{ luminarId: item.id }}
      className="group edge-light flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/15 to-violet-500/10">
        <svg viewBox="0 0 800 500" className="h-full w-full opacity-70" preserveAspectRatio="xMidYMid slice">
          <pattern id={`d-${item.id}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" className="fill-primary/40" />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#d-${item.id})`} />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid size-12 place-items-center rounded-full bg-background/80 text-primary shadow-lg backdrop-blur transition-transform group-hover:scale-110">
            <HugeiconsIcon icon={PlayIcon} size={20} />
          </div>
        </div>
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white backdrop-blur">
          <HugeiconsIcon icon={Clock01Icon} size={11} />{item.duration_minutes}m
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-sm font-semibold tracking-tight">{item.title}</h3>
        {item.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{item.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <Avatar className="size-6">
            <AvatarImage src={item.author_avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px]">{initials(item.author_name)}</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground truncate text-xs">{item.author_name}</span>
        </div>
      </div>
    </Link>
  )
}
