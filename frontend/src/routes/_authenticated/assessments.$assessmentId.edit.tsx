import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { AssessmentBuilder } from "@/components/assessment/AssessmentBuilder"
import { assessmentApi } from "@/lib/api"

export const Route = createFileRoute("/_authenticated/assessments/$assessmentId/edit")({
  component: EditAssessmentPage,
})

function EditAssessmentPage() {
  const { assessmentId } = Route.useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => assessmentApi.get(assessmentId),
  })

  if (isLoading) {
    return <div className="mx-auto max-w-3xl space-y-3 px-6 py-10">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
  }
  if (isError || !data || !data.is_owner) {
    return <div className="text-muted-foreground py-24 text-center text-sm">Assessment not found.</div>
  }
  // key: remount the builder if the user navigates between assessments.
  return <AssessmentBuilder key={data.id} initial={data} />
}
