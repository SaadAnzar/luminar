import { Link, useRouterState } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MagicWand01Icon,
  PlayListIcon,
  UserIcon,
  Logout03Icon,
  Compass01Icon,
  TaskDone01Icon,
} from "@hugeicons/core-free-icons"
import { cn, initials } from "@/lib/utils"
import { Logo } from "./Logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const staticNav = [
  { to: "/home", label: "My Luminars", icon: PlayListIcon },
  { to: "/discover", label: "Discover", icon: Compass01Icon },
  { to: "/create", label: "Create", icon: MagicWand01Icon },
  { to: "/assessments", label: "Assessments", icon: TaskDone01Icon },
] as const

export function AppSidebar() {
  const { location } = useRouterState()
  const { user, logout } = useAuth()
  const email = user?.email ?? ""
  const name = user?.name ?? email.split("@")[0]
  const avatarUrl = user?.avatar_url ?? ""

  const nav = [
    ...staticNav,
    ...(user?.id ? [{ to: `/profile/${user.id}`, label: "Profile", icon: UserIcon }] : []),
  ]

  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-5 py-5">
        <Link to="/" className="block">
          <Logo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/")
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "text-sidebar-accent-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <HugeiconsIcon
                icon={item.icon}
                size={18}
                className={cn("relative z-10", active && "text-primary")}
              />
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-sidebar-border p-3">
        <Avatar className="size-9">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name || "Guest"}</div>
          <div className="truncate text-xs text-muted-foreground">{email || "Not signed in"}</div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => logout()}
              aria-label="Sign out"
            >
              <HugeiconsIcon icon={Logout03Icon} size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}
