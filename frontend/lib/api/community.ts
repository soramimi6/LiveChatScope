import { ApiError, getTopics, type TopicsResponse } from "@/lib/api";

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

export type AuthorItem = {
  author_id: string;
  author_name: string;
  message_count: number;
  rank: number;
  is_core_regular: boolean;
};

export type AuthorsResponse = {
  video_id: string;
  items: AuthorItem[];
};

export type TopicAuthorItem = {
  author_name: string;
  message_count: number;
  rank: number;
};

export type AuthorsByTopicResponse = {
  block_id: string;
  items: TopicAuthorItem[];
};

export type CommunityTabData = {
  authors: AuthorsResponse;
  topics: TopicsResponse;
};

export function getAuthors(videoId: string, limit = 20) {
  return request<AuthorsResponse>(
    `/api/v1/videos/${videoId}/authors?limit=${limit}`,
  );
}

export function getAuthorsByTopic(videoId: string, blockId: string) {
  return request<AuthorsByTopicResponse>(
    `/api/v1/videos/${videoId}/authors/by-topic/${blockId}`,
  );
}

export { getTopics };

export async function getCommunityTabDataWithFallback(
  videoId: string,
): Promise<{ data: CommunityTabData; isMock: boolean }> {
  try {
    const [authors, topics] = await Promise.all([
      getAuthors(videoId),
      getTopics(videoId),
    ]);
    return { data: { authors, topics }, isMock: false };
  } catch {
    const { getMockCommunityTabData } = await import("@/lib/mocks/community");
    return { data: getMockCommunityTabData(videoId), isMock: true };
  }
}

export async function getAuthorsByTopicWithFallback(
  videoId: string,
  blockId: string,
): Promise<{ data: AuthorsByTopicResponse; isMock: boolean }> {
  try {
    const data = await getAuthorsByTopic(videoId, blockId);
    return { data, isMock: false };
  } catch {
    const { getMockAuthorsByTopic } = await import("@/lib/mocks/community");
    return { data: getMockAuthorsByTopic(blockId), isMock: true };
  }
}
