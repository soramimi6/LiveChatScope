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
  registered_during_stream: boolean;
  used_membership_gift: boolean;
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

export type AuthorMessageMoment = {
  time_in_seconds: number;
  time_text: string;
  jump_url: string;
};

export type AuthorProfileTopic = {
  block_id: string;
  block_index: number;
  label: string;
  message_count: number;
  jump_url: string;
};

export type AuthorProfileResponse = {
  video_id: string;
  author_id: string;
  author_name: string;
  message_count: number;
  rank: number;
  is_core_regular: boolean;
  block_participation: {
    participated_blocks: number;
    total_blocks: number;
    ratio: number;
  };
  first_message: AuthorMessageMoment | null;
  last_message: AuthorMessageMoment | null;
  super_chat_total: {
    currency: string;
    amount: number;
    count: number;
  }[];
  top_topics: AuthorProfileTopic[];
  registered_during_stream: boolean;
  used_membership_gift: boolean;
  membership_registration: AuthorMessageMoment | null;
  membership_gift: AuthorMessageMoment | null;
};

export type MembershipRegistrationItem = {
  author_id: string;
  author_name: string;
  time_in_seconds: number | null;
  time_text: string | null;
  time_unknown: boolean;
  jump_url: string | null;
  registered_during_stream: boolean;
};

export type MembershipBurstItem = {
  rank: number;
  peak_bucket_start_sec: number;
  peak_time_text: string;
  peak_count: number;
  baseline_count: number;
  burst_ratio: number;
  burst_score: number;
  jump_url: string;
  nearby_topic: {
    label: string;
    start_sec: number;
    end_sec: number;
    jump_url: string;
  } | null;
  nearby_highlight: {
    rank: number;
    time_in_seconds: number;
    time_text: string;
    jump_url: string;
  } | null;
};

export type MembershipEventsResponse = {
  video_id: string;
  total_unique: number;
  timeline: { bucket_start_sec: number; count: number }[];
  bursts: MembershipBurstItem[];
  registrations: MembershipRegistrationItem[];
};

export type MembershipGiftItem = {
  author_id: string;
  author_name: string;
  time_in_seconds: number | null;
  time_text: string | null;
  time_unknown: boolean;
  jump_url: string | null;
  used_membership_gift: boolean;
};

export type MembershipGiftsResponse = {
  video_id: string;
  total_unique: number;
  items: MembershipGiftItem[];
};

export type CommunityTabData = {
  authors: AuthorsResponse;
  topics: TopicsResponse;
  membershipEvents: MembershipEventsResponse;
  membershipGifts: MembershipGiftsResponse;
};

export function getMembershipEvents(videoId: string) {
  return request<MembershipEventsResponse>(
    `/api/v1/videos/${videoId}/membership-events`,
  );
}

export function getMembershipGifts(videoId: string) {
  return request<MembershipGiftsResponse>(
    `/api/v1/videos/${videoId}/membership-gifts`,
  );
}

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

export function getAuthorProfile(videoId: string, authorId: string) {
  return request<AuthorProfileResponse>(
    `/api/v1/videos/${videoId}/authors/${encodeURIComponent(authorId)}/profile`,
  );
}

export { getTopics };

export async function getCommunityTabDataWithFallback(
  videoId: string,
): Promise<{ data: CommunityTabData; isMock: boolean }> {
  try {
    const [authors, topics, membershipEvents, membershipGifts] = await Promise.all([
      getAuthors(videoId),
      getTopics(videoId),
      getMembershipEvents(videoId),
      getMembershipGifts(videoId),
    ]);
    return {
      data: { authors, topics, membershipEvents, membershipGifts },
      isMock: false,
    };
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

export async function getAuthorProfileWithFallback(
  videoId: string,
  authorId: string,
): Promise<{ data: AuthorProfileResponse; isMock: boolean }> {
  try {
    const data = await getAuthorProfile(videoId, authorId);
    return { data, isMock: false };
  } catch {
    const { getMockAuthorProfile } = await import("@/lib/mocks/community");
    return { data: getMockAuthorProfile(videoId, authorId), isMock: true };
  }
}
