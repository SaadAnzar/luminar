import { createRootRouteWithContext, Outlet, useRouterState } from "@tanstack/react-router"
import { AnimatePresence } from "framer-motion"
import type { QueryClient } from "@tanstack/react-query"
import { PageTransition } from "@/components/motion/PageTransition"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const { location } = useRouterState()
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Outlet />
      </PageTransition>
    </AnimatePresence>
  )
}
