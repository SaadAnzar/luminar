import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/social")({
  component: () => <Navigate to="/home" />,
})
