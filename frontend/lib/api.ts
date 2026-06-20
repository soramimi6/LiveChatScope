const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

export type CreateVideoResponse = {
  video_id: string;
  fetch_status: string;
  analysis_status: string;
  status_url: string;
};

export type VideoStatusResponse = {
  video_id: string;
  fetch_status: string;
  analysis_status: string;
  progress: {
    messages_fetched: number;
    messages_total_estimate: number | null;
    analysis_stage: number | null;
    analysis_stage_label: string | null;
  };
  error: { code: string; message: string } | null;
};

export type VideoMetaResponse = {
  video_id: string;
  title: string | null;
  channel_name: string | null;
  duration_seconds: number | null;
  message_count: number;
  fetch_status: string;
  analysis_status: string;
  fetched_at: string | null;
  analyzed_at: string | null;
};

export function createVideo(url: string) {
  return request<CreateVideoResponse>("/api/v1/videos", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getVideoStatus(videoId: string) {
  return request<VideoStatusResponse>(`/api/v1/videos/${videoId}/status`);
}

export function getVideo(videoId: string) {
  return request<VideoMetaResponse>(`/api/v1/videos/${videoId}`);
}

export type SummaryPeak = {
  time_in_seconds: number;
  time_text: string;
  density: number;
  jump_url: string;
};

export type SuperChatTotal = {
  currency: string;
  amount: number;
  count: number;
};

export type SummaryHighlight = {
  rank: number;
  time_in_seconds: number;
  time_text: string;
  score: number;
  jump_url: string;
};

export type SummaryKeyword = {
  token: string;
  count: number;
  rank: number;
};

export type TopicBlockPreview = {
  block_id: string;
  block_index: number;
  start_sec: number;
  end_sec: number;
  label: string;
  label_note: string;
  message_count: number;
  unique_authors: number;
  jump_url: string;
};

export type SummaryResponse = {
  video_id: string;
  message_count: number;
  unique_authors: number;
  peak: SummaryPeak;
  super_chat_total: SuperChatTotal[];
  topic_block_count: number;
  top_highlights: SummaryHighlight[];
  top_keywords: SummaryKeyword[];
  topic_blocks_preview: TopicBlockPreview[];
  generated_at: string;
};

export function getSummary(videoId: string) {
  return request<SummaryResponse>(`/api/v1/videos/${videoId}/summary`);
}

export async function getSummaryWithFallback(
  videoId: string,
): Promise<{ data: SummaryResponse; isMock: boolean }> {
  try {
    const data = await getSummary(videoId);
    return { data, isMock: false };
  } catch {
    const { getMockSummary } = await import("@/lib/mocks/summary");
    return { data: getMockSummary(videoId), isMock: true };
  }
}
