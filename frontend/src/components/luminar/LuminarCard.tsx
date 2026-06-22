import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PlayIcon,
  Clock01Icon,
  Bookmark01Icon,
  AlertCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Luminar } from "@/lib/schemas"

interface LuminarCardProps {
  luminar: Luminar
  variant?: "created" | "draft" | "favourited"
  isFavorited?: boolean
  onFavoriteToggle?: (luminarId: string, current: boolean) => void
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  script_generating: "Writing script…",
  script_ready: "Review script",
  assets_generating: "Generating…",
  ready: "Ready",
  failed: "Failed",
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  script_generating: "bg-blue-500/15 text-blue-600",
  script_ready: "bg-amber-500/15 text-amber-600",
  assets_generating: "bg-violet-500/15 text-violet-600",
  ready: "bg-emerald-500/15 text-emerald-600",
  failed: "bg-red-500/15 text-red-600",
}

const SOURCE_ICON: Record<string, string> = {
  pdf: "PDF",
  txt: "TXT",
  ppt: "PPT",
  docx: "DOCX",
  blog: "WEB",
  website: "WEB",
  youtube: "YT",
  none: "",
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLOR[status] ?? "bg-muted text-muted-foreground")}>
      {(status === "script_generating" || status === "assets_generating") && (
        <HugeiconsIcon icon={Loading03Icon} size={10} className="animate-spin" />
      )}
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function LuminarCard({ luminar, isFavorited = false, onFavoriteToggle }: LuminarCardProps) {
  const isScriptReady = luminar.status === "script_ready"
  const isFailed = luminar.status === "failed"

  const href = luminar.status === "ready"
    ? `/watch/${luminar.id}`
    : isScriptReady
    ? `/script-review/${luminar.id}`
    : `/generating/${luminar.id}`

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {/* Thumbnail / placeholder */}
      <Link to={href} className="block">
        <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-emerald-500/10">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-30">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id={`dots-${luminar.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="currentColor" className="text-primary" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#dots-${luminar.id})`} />
            </svg>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur-sm">
            <HugeiconsIcon icon={Clock01Icon} size={10} />
            {luminar.duration_minutes} min
          </div>

          {/* Source badge */}
          {luminar.source_type !== "none" && (
            <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur-sm">
              {SOURCE_ICON[luminar.source_type]}
            </div>
          )}

          {/* Overlay play button for ready luminars */}
          {luminar.status === "ready" && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
                <HugeiconsIcon icon={PlayIcon} size={20} />
              </div>
            </div>
          )}

          {/* Script ready CTA overlay */}
          {isScriptReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-amber-500/10 backdrop-blur-[1px]">
              <span className="text-xs font-semibold text-amber-700">Script ready to review</span>
              <span className="text-[10px] text-amber-600/80">Approve to generate luminar</span>
            </div>
          )}

          {/* Failed overlay */}
          {isFailed && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-red-500/10">
              <HugeiconsIcon icon={AlertCircleIcon} size={16} className="text-red-500" />
              <span className="text-xs text-red-600">Generation failed</span>
            </div>
          )}
        </div>
      </Link>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={href} className="flex-1 min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
              {luminar.title}
            </h3>
          </Link>
          {onFavoriteToggle && (
            <button
              onClick={(e) => { e.preventDefault(); onFavoriteToggle(luminar.id, isFavorited) }}
              className={cn("mt-0.5 shrink-0 transition-colors", isFavorited ? "text-rose-500" : "text-muted-foreground hover:text-rose-400")}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <HugeiconsIcon icon={Bookmark01Icon} size={15} />
            </button>
          )}
        </div>

        {luminar.description && (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{luminar.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <StatusPill status={luminar.status} />
          <span className="text-[10px] text-muted-foreground">
            {new Date(luminar.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>

        {/* Progress bar for active generation */}
        {(luminar.status === "script_generating" || luminar.status === "assets_generating") && (
          <Progress value={undefined} className="h-0.5 animate-pulse" />
        )}
      </div>
    </div>
  )
}
