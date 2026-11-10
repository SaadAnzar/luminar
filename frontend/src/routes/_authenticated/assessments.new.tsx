import { createFileRoute } from "@tanstack/react-router"
import { AssessmentBuilder } from "@/components/assessment/AssessmentBuilder"

export const Route = createFileRoute("/_authenticated/assessments/new")({
  component: () => <AssessmentBuilder />,
})
