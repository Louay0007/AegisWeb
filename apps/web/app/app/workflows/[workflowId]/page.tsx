import { WorkflowDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  return <WorkflowDetailPage id={workflowId} />;
}
