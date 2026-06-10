/**
 * Browser-only file download helper. Wraps `apiDownload` with the
 * `URL.createObjectURL` + anchor-click dance so callers don't have to
 * duplicate it everywhere.
 */
import { apiDownload } from "@/lib/api/api-client";

export async function downloadEndpoint(path: string, fallbackName: string = "aegisweb-download") {
  const { blob, filename } = await apiDownload(path);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return { blob, filename };
}
