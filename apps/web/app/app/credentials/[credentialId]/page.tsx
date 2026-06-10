import { CredentialDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  return <CredentialDetailPage id={credentialId} />;
}
