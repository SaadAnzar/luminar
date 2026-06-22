import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/knowledge")({
  component: () => <Navigate to="/home" />,
})
