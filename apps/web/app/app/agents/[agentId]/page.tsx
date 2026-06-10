import { AgentDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return <AgentDetailPage id={agentId} />;
}
