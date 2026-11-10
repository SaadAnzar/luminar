import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  Compass01Icon,
  FavouriteIcon,
  PlayIcon,
  PlayListIcon,
  SparklesIcon,
  TaskDone01Icon,
  UserGroupIcon,
  Video01Icon,
  ViewIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FadeIn } from "@/components/motion/FadeIn"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { assessmentApi, discoverApi } from "@/lib/api"
import type { DirectoryItem, DiscoverItem } from "@/lib/schemas"
import { youtubeVideoId } from "@/lib/youtube"
import { initials } from "@/lib/utils"

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
})

function DiscoverPage() {
  const [tab, setTab] = useState("lessons")
  const lessons = useQuery({ queryKey: ["discover"], queryFn: () => discoverApi.feed() })
  const assessments = useQuery({
    queryKey: ["assessment-directory"],
    queryFn: () => assessmentApi.directory(),
    enabled: tab === "assessments",
  })

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <FadeIn className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
          <HugeiconsIcon icon={Compass01Icon} size={22} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Discover</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Lessons and assessments shared by the community — watch and test yourself.</p>
        </div>
      </FadeIn>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="lessons" className="gap-2"><HugeiconsIcon icon={PlayListIcon} size={14} />Lessons</TabsTrigger>
          <TabsTrigger value="assessments" className="gap-2"><HugeiconsIcon icon={TaskDone01Icon} size={14} />Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons">
          <Grid
            loading={lessons.isLoading}
            empty={!lessons.data?.length}
            emptyText="Nothing published yet. Be the first — open one of your luminars and hit Publish."
          >
            {(lessons.data ?? []).map((it) => <StaggerItem key={it.id}><LessonCard item={it} /></StaggerItem>)}
          </Grid>
        </TabsContent>
        <TabsContent value="assessments">
          <Grid
            loading={assessments.isLoading}
            empty={!assessments.data?.length}
            emptyText="No listed assessments yet. Turn on “List in Discover” when you publish one."
          >
            {(assessments.data ?? []).map((it) => <StaggerItem key={it.id}><AssessmentCard item={it} /></StaggerItem>)}
          </Grid>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Grid({ loading, empty, emptyText, children }: {
  loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 py-24 text-center">
        <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
          <HugeiconsIcon icon={SparklesIcon} size={26} />
        </div>
        <p className="text-muted-foreground max-w-xs text-sm">{emptyText}</p>
      </div>
    )
  }
  return <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</Stagger>
}

function DotsArt({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 800 500" className="h-full w-full opacity-70" preserveAspectRatio="xMidYMid slice">
      <pattern id={`d-${id}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.5" className="fill-primary/40" />
      </pattern>
      <rect width="100%" height="100%" fill={`url(#d-${id})`} />
    </svg>
  )
}

function Author({ name, avatar }: { name: string; avatar?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage src={avatar ?? undefined} />
        <AvatarFallback className="text-[9px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="text-muted-foreground truncate text-xs">{name}</span>
    </div>
  )
}

function LessonCard({ item }: { item: DiscoverItem }) {
  return (
    <Link
      to="/watch/$luminarId"
      params={{ luminarId: item.id }}
      className="group edge-light flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary/15 to-violet-500/10">
        <DotsArt id={item.id} />
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
        <div className="mt-auto flex items-center gap-3 pt-3">
          <Author name={item.author_name} avatar={item.author_avatar_url} />
          <span className="text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-2.5 text-[11px]">
            <span className="inline-flex items-center gap-1" title="Likes"><HugeiconsIcon icon={FavouriteIcon} size={12} />{item.like_count}</span>
            <span className="inline-flex items-center gap-1" title="Views"><HugeiconsIcon icon={ViewIcon} size={12} />{item.view_count}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

function AssessmentCard({ item }: { item: DirectoryItem }) {
  const videoId = youtubeVideoId(item.youtube_url)
  const icon = item.source_type === "youtube" ? YoutubeIcon : item.source_type === "upload" ? Video01Icon : PlayListIcon
  return (
    <Link
      to="/take/$assessmentId"
      params={{ assessmentId: item.id }}
      className="group edge-light flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-amber-500/15 to-primary/10">
        {videoId ? (
          <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />
        ) : (
          <DotsArt id={item.id} />
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white backdrop-blur">
          <HugeiconsIcon icon={icon} size={11} />{item.question_count} questions
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-sm font-semibold tracking-tight">{item.title}</h3>
        {item.objective && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{item.objective}</p>}
        <div className="mt-auto flex items-center gap-3 pt-3">
          <Author name={item.author_name} avatar={item.author_avatar_url} />
          <span className="text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-1 text-[11px]" title="Learners">
            <HugeiconsIcon icon={UserGroupIcon} size={12} />{item.learner_count}
          </span>
        </div>
      </div>
    </Link>
  )
}
