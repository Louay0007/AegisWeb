export type DownloadableScreenshotEvidence = {
  id: string;
  title: string;
  fileId?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  downloadHref?: string;
};

export function isDownloadableImageEvidence(evidence: DownloadableScreenshotEvidence) {
  return Boolean(evidence.downloadHref && evidence.mimeType?.toLowerCase().startsWith("image/"));
}

export function screenshotDownloadName(evidence: DownloadableScreenshotEvidence) {
  const extension = extensionForMime(evidence.mimeType);
  return `${slugify(evidence.title || evidence.fileId || evidence.id)}${extension}`;
}

function extensionForMime(mimeType: string | undefined) {
  if (!mimeType) return "";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  return "";
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "screenshot-evidence";
}
