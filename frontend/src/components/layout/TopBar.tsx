import { Link, useRouterState } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Notification03Icon,
  MagicWand01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCommandPalette } from "./CommandPalette"
import { ThemeToggle } from "./ThemeToggle"
import { cn } from "@/lib/utils"

const labels: Record<string, string> = {
  "": "Home",
  create: "Create",
  social: "Explore",
  knowledge: "Knowledge",
  library: "Library",
  watch: "Now playing",
  profile: "Profile",
  generating: "Generating",
  assessments: "Assessments",
  take: "Assessment",
  login: "Sign in",
  register: "Sign up",
}

export function TopBar() {
  const { location } = useRouterState()
  const segments = location.pathname.split("/").filter(Boolean)
  const topLabel = labels[segments[0] ?? ""] ?? "Luminar"
  const { toggle } = useCommandPalette()

  return (
    <header className={cn("glass sticky top-0 z-30 border-b")}>
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-muted-foreground hidden sm:inline">Luminar</span>
          <span className="text-muted-foreground/50 hidden sm:inline">/</span>
          <span className="truncate font-medium">{topLabel}</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={toggle}
          className={cn(
            "hover:border-foreground/20 text-muted-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-md border text-sm transition-colors md:w-64 md:justify-start md:px-3",
          )}
        >
          <HugeiconsIcon icon={Search01Icon} size={15} />
          <span className="hidden flex-1 text-left md:inline">Search…</span>
          <kbd className="bg-muted text-muted-foreground hidden rounded px-1.5 py-0.5 font-mono text-[10px] md:inline">
            ⌘K
          </kbd>
        </button>

        <Separator orientation="vertical" className="h-6" />

        <ThemeToggle className="size-9" />

        <Button variant="ghost" size="icon" className="size-9" aria-label="Notifications">
          <HugeiconsIcon icon={Notification03Icon} size={16} />
        </Button>

        <Button asChild size="sm" className="gap-2">
          <Link to="/create">
            <HugeiconsIcon icon={MagicWand01Icon} size={15} />
            Create
          </Link>
        </Button>
      </div>
    </header>
  )
}
