import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router"
import { AnimatePresence } from "framer-motion"
import { AppShell } from "@/components/layout/AppShell"
import { CommandPaletteProvider } from "@/components/layout/CommandPalette"
import { PageTransition } from "@/components/motion/PageTransition"
import { isTokenExpired } from "@/lib/api"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    const token = localStorage.getItem("luminar_token")
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem("luminar_token")
      localStorage.removeItem("luminar_user")
      throw redirect({ to: "/signin" })
    }
    // Send users who explicitly haven't onboarded to onboarding first.
    // (undefined = older session predating the field → treat as onboarded.)
    let needsOnboarding = false
    try {
      const u = JSON.parse(localStorage.getItem("luminar_user") || "null")
      needsOnboarding = !!u && u.onboarded === false
    } catch { /* ignore parse errors */ }
    if (needsOnboarding) throw redirect({ to: "/onboarding" })
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { location } = useRouterState()
  return (
    <CommandPaletteProvider>
      <AppShell>
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </AppShell>
    </CommandPaletteProvider>
  )
}
