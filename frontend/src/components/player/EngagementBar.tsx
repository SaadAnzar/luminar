import { useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { FavouriteIcon, ViewIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { luminarApi } from "@/lib/api"
import type { Engagement } from "@/lib/schemas"
import { cn } from "@/lib/utils"

/** Public likes + unique views for a ready luminar. Records this visit once. */
export function EngagementBar({ luminarId }: { luminarId: string }) {
  const qc = useQueryClient()
  const key = ["engagement", luminarId]
  const { data } = useQuery({ queryKey: key, queryFn: () => luminarApi.engagement(luminarId) })

  // Count the visit once per mount (the server dedupes per user and ignores the author).
  const recorded = useRef(false)
  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    luminarApi
      .recordView(luminarId)
      .then((e) => qc.setQueryData(["engagement", luminarId], e))
      .catch(() => {})
  }, [luminarId, qc])

  const like = useMutation({
    mutationFn: (liked: boolean) => luminarApi.setLiked(luminarId, liked),
    onMutate: async (liked) => {
      const prev = qc.getQueryData<Engagement>(key)
      if (prev) {
        qc.setQueryData<Engagement>(key, {
          ...prev,
          liked_by_me: liked,
          like_count: Math.max(0, prev.like_count + (liked ? 1 : -1)),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast.error("Could not update your like")
    },
    onSuccess: (e) => {
      qc.setQueryData(key, e)
      qc.invalidateQueries({ queryKey: ["discover"] })
    },
  })

  const liked = !!data?.liked_by_me
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground inline-flex items-center gap-1 px-1 text-xs" title="Unique viewers">
        <HugeiconsIcon icon={ViewIcon} size={14} />
        {data?.view_count ?? "–"}
      </span>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={liked}
        disabled={!data || like.isPending}
        onClick={() => like.mutate(!liked)}
        className={cn("gap-1.5 rounded-full", liked && "border-rose-300 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15")}
      >
        <HugeiconsIcon icon={FavouriteIcon} size={14} className={cn(liked && "fill-current")} />
        {data?.like_count ?? 0}
      </Button>
    </div>
  )
}
