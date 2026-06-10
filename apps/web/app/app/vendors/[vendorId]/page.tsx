import { VendorDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  return <VendorDetailPage id={vendorId} />;
}
