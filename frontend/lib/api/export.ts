const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ExportType =
  | "json"
  | "csv"
  | "markdown-summary"
  | "markdown-clips"
  | "markdown-thanks";

export class ExportError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

function exportPath(
  videoId: string,
  type: ExportType,
  download?: boolean,
): string {
  const params = download ? "?download=true" : "";
  return `/api/v1/videos/${videoId}/export/${type}${params}`;
}

function contentTypeFor(type: ExportType): string {
  if (type === "json") return "application/json";
  if (type === "csv") return "text/csv";
  return "text/markdown";
}

export function exportFilename(videoId: string, type: ExportType): string {
  if (type === "json") return `${videoId}.json`;
  if (type === "csv") return `${videoId}.csv`;
  return `${videoId}-${type}.md`;
}

/** GET `/api/v1/videos/{id}/export/{type}` — テキスト body を返す */
export async function fetchExport(
  videoId: string,
  type: ExportType,
  options?: { download?: boolean },
): Promise<string> {
  const path = exportPath(videoId, type, options?.download);
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? body?.detail?.error ?? body?.detail;
    throw new ExportError(
      err?.message ?? `Export error ${res.status}`,
      res.status,
      err?.code,
    );
  }

  return res.text();
}

export function downloadText(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadExport(
  videoId: string,
  type: ExportType,
): Promise<void> {
  const content = await fetchExport(videoId, type, { download: true });
  downloadText(
    content,
    exportFilename(videoId, type),
    contentTypeFor(type),
  );
}

export async function copyExportToClipboard(
  videoId: string,
  type: ExportType,
): Promise<void> {
  const content = await fetchExport(videoId, type);
  await navigator.clipboard.writeText(content);
}
