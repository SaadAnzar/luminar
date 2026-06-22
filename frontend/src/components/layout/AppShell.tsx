import type { ReactNode } from "react"
import { AppSidebar } from "./AppSidebar"
import { TopBar } from "./TopBar"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-svh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
