import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/library")({
  component: () => <Navigate to="/home" />,
})
