import { ReceiptDetailPage } from "@/components/dashboard/list-pages";

export default async function Page({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  return <ReceiptDetailPage id={receiptId} />;
}
