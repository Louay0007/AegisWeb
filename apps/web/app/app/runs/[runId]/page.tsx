import { RunDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunDetailPage id={runId} />;
}
