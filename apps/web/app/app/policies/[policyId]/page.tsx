import { PolicyDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await params;
  return <PolicyDetailPage id={policyId} />;
}
