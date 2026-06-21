import type { ExportType } from "@/lib/api/export";

const EXPORT_PREFIX = "LiveChatScope_Result";

const MARKDOWN_SUFFIX: Record<
  Extract<ExportType, `markdown-${string}`>,
  string
> = {
  "markdown-summary": "summary",
  "markdown-clips": "clips",
  "markdown-thanks": "thanks",
};

function sanitizeVideoId(videoId: string): string {
  const cleaned = videoId.replace(/[\\/:*?"<>|\0]/g, "");
  return cleaned || "unknown";
}

/** Human-readable download filename for export files. */
export function exportFilename(videoId: string, type: ExportType): string {
  const safeId = sanitizeVideoId(videoId);
  if (type === "json") return `${EXPORT_PREFIX}_${safeId}.json`;
  if (type === "csv") return `${EXPORT_PREFIX}_${safeId}.csv`;
  const suffix = MARKDOWN_SUFFIX[type];
  return `${EXPORT_PREFIX}_${safeId}_${suffix}.md`;
}
