import { ApiError } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = body?.error ?? body?.detail?.error ?? body?.detail;
    throw new ApiError(
      err?.message ?? `API error ${res.status}`,
      res.status,
      err?.code,
    );
  }

  return body as T;
}

export type SuperChatCurrencySummary = {
  currency: string;
  total_amount: number;
  count: number;
};

export type SuperChatTimelineBucket = {
  bucket_start_sec: number;
  count: number;
  amount_jpy: number;
};

export type SuperChatSummaryResponse = {
  video_id: string;
  by_currency: SuperChatCurrencySummary[];
  timeline: SuperChatTimelineBucket[];
};

export type SuperChatItem = {
  time_in_seconds: number;
  time_text: string;
  author_name: string;
  amount: number;
  currency: string;
  message: string;
  jump_url: string;
};

export type SuperChatsResponse = {
  video_id: string;
  items: SuperChatItem[];
  pagination: { page: number; page_size: number; total: number };
};

export type DensityBucket = {
  bucket_start_sec: number;
  count: number;
};

export type DensityResponse = {
  video_id: string;
  bucket_sec: number;
  buckets: DensityBucket[];
  average_count: number;
};

export type RevenueTabData = {
  summary: SuperChatSummaryResponse;
  superChats: SuperChatsResponse;
  density: DensityResponse;
};

export type ExportType = "csv" | "markdown-thanks";

export function getSuperChatSummary(videoId: string) {
  return request<SuperChatSummaryResponse>(
    `/api/v1/videos/${videoId}/super-chats/summary`,
  );
}

export function getSuperChats(videoId: string, page = 1, pageSize = 50) {
  return request<SuperChatsResponse>(
    `/api/v1/videos/${videoId}/super-chats?page=${page}&page_size=${pageSize}`,
  );
}

export function getDensity(videoId: string, bucketSec = 60) {
  return request<DensityResponse>(
    `/api/v1/videos/${videoId}/density?bucket_sec=${bucketSec}`,
  );
}

export async function getRevenueTabDataWithFallback(
  videoId: string,
): Promise<{ data: RevenueTabData; isMock: boolean }> {
  try {
    const [summary, superChats, density] = await Promise.all([
      getSuperChatSummary(videoId),
      getSuperChats(videoId),
      getDensity(videoId),
    ]);
    return { data: { summary, superChats, density }, isMock: false };
  } catch {
    const { getMockRevenueTabData } = await import("@/lib/mocks/revenue");
    return { data: getMockRevenueTabData(videoId), isMock: true };
  }
}

async function fetchExportText(
  videoId: string,
  type: ExportType,
  download = false,
): Promise<string> {
  const q = download ? "?download=true" : "";
  const res = await fetch(
    `${API_BASE}/api/v1/videos/${videoId}/export/${type}${q}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new ApiError(`Export failed ${res.status}`, res.status);
  }
  return res.text();
}

export function buildThankYouCsv(items: SuperChatItem[]): string {
  const header = "時刻,投稿者,金額,通貨,メッセージ,ジャンプURL";
  const rows = items.map((item) =>
    [
      item.time_text,
      item.author_name,
      item.amount,
      item.currency,
      `"${item.message.replace(/"/g, '""')}"`,
      item.jump_url,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function buildThankYouMarkdown(items: SuperChatItem[]): string {
  const lines = ["# スパチャお礼リスト", ""];
  for (const item of items) {
    lines.push(
      `- **${item.time_text}** ${item.author_name} — ${item.amount.toLocaleString()} ${item.currency}`,
    );
    if (item.message) {
      lines.push(`  - ${item.message}`);
    }
    lines.push(`  - [YouTube で見る](${item.jump_url})`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function getThankYouExportWithFallback(
  videoId: string,
  type: ExportType,
  fallbackItems: SuperChatItem[],
): Promise<{ content: string; fromMock: boolean }> {
  try {
    const content = await fetchExportText(videoId, type);
    return { content, fromMock: false };
  } catch {
    const content =
      type === "csv"
        ? buildThankYouCsv(fallbackItems)
        : buildThankYouMarkdown(fallbackItems);
    return { content, fromMock: true };
  }
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
