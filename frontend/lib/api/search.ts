import { ApiError } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type MessageItem = {
  message_id: string;
  time_in_seconds: number;
  time_text: string;
  author_name: string;
  message_type: string;
  text: string;
  jump_url: string;
};

export type MessagesPagination = {
  page: number;
  page_size: number;
  total: number;
};

export type MessagesResponse = {
  video_id: string;
  items: MessageItem[];
  pagination: MessagesPagination;
};

export type SearchMessagesParams = {
  q?: string;
  author?: string;
  message_type?: string;
  page?: number;
  page_size?: number;
};

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

function buildSearchQuery(params: SearchMessagesParams): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.author?.trim()) search.set("author", params.author.trim());
  if (params.message_type?.trim()) {
    search.set("message_type", params.message_type.trim());
  }
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.page_size ?? 50));
  return search.toString();
}

export function searchMessages(videoId: string, params: SearchMessagesParams = {}) {
  const query = buildSearchQuery(params);
  return request<MessagesResponse>(`/api/v1/videos/${videoId}/messages?${query}`);
}

export async function searchMessagesWithFallback(
  videoId: string,
  params: SearchMessagesParams = {},
): Promise<{ data: MessagesResponse; isMock: boolean }> {
  try {
    const data = await searchMessages(videoId, params);
    return { data, isMock: false };
  } catch {
    const { getMockMessages } = await import("@/lib/mocks/search");
    return { data: getMockMessages(videoId, params), isMock: true };
  }
}
