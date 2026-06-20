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

async function requestText(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? body?.detail?.error ?? body?.detail;
    throw new ApiError(
      err?.message ?? `API error ${res.status}`,
      res.status,
      err?.code,
    );
  }

  return res.text();
}

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

export type HighlightItem = {
  rank: number;
  time_in_seconds: number;
  time_text: string;
  score: number;
  clip_start_sec: number;
  clip_end_sec: number;
  jump_url: string;
};

export type HighlightsResponse = {
  video_id: string;
  items: HighlightItem[];
};

export type LowActivityItem = {
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  avg_density: number;
  start_jump_url: string;
};

export type LowActivityResponse = {
  video_id: string;
  items: LowActivityItem[];
};

export type HighlightsTabData = {
  density: DensityResponse;
  highlights: HighlightsResponse;
  lowActivity: LowActivityResponse;
};

export function getDensity(videoId: string, bucketSec = 60) {
  return request<DensityResponse>(
    `/api/v1/videos/${videoId}/density?bucket_sec=${bucketSec}`,
  );
}

export function getHighlights(videoId: string, limit = 10) {
  return request<HighlightsResponse>(
    `/api/v1/videos/${videoId}/highlights?limit=${limit}`,
  );
}

export function getLowActivity(videoId: string) {
  return request<LowActivityResponse>(`/api/v1/videos/${videoId}/low-activity`);
}

export function getMarkdownClipsExport(videoId: string) {
  return requestText(`/api/v1/videos/${videoId}/export/markdown-clips`);
}

function formatTimeText(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildMarkdownClipsLocal(
  videoId: string,
  highlights: HighlightItem[],
  title?: string,
): string {
  const heading = title ? `${title} — 切り抜き候補` : "切り抜き候補";
  const lines = [
    `# ${heading}`,
    "",
    `動画: https://www.youtube.com/watch?v=${videoId}`,
    "",
  ];

  if (highlights.length === 0) {
    lines.push("盛り上がり候補は検出されませんでした。");
    return lines.join("\n");
  }

  for (const hl of highlights) {
    lines.push(
      `- ${formatTimeText(hl.clip_start_sec)} 盛り上がり #${hl.rank} (スコア ${hl.score.toFixed(1)})`,
      `  - ピーク: ${formatTimeText(hl.time_in_seconds)}`,
      `  - 範囲: ${formatTimeText(hl.clip_start_sec)} – ${formatTimeText(hl.clip_end_sec)}`,
      "",
    );
  }

  return lines.join("\n");
}

export async function getHighlightsTabDataWithFallback(
  videoId: string,
): Promise<{ data: HighlightsTabData; isMock: boolean }> {
  try {
    const [density, highlights, lowActivity] = await Promise.all([
      getDensity(videoId),
      getHighlights(videoId),
      getLowActivity(videoId),
    ]);
    return { data: { density, highlights, lowActivity }, isMock: false };
  } catch {
    const { getMockHighlightsTabData } = await import("@/lib/mocks/highlights");
    return { data: getMockHighlightsTabData(videoId), isMock: true };
  }
}

export async function getMarkdownClipsWithFallback(
  videoId: string,
  highlights: HighlightItem[],
  title?: string,
): Promise<string> {
  try {
    return await getMarkdownClipsExport(videoId);
  } catch {
    return buildMarkdownClipsLocal(videoId, highlights, title);
  }
}
