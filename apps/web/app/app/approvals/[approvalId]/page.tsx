import { ApprovalDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await params;
  return <ApprovalDetailPage id={approvalId} />;
}
