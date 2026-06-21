import { formatSeconds, youtubeJumpUrl } from "@/lib/format";
import type {
  DensityResponse,
  RevenueTabData,
  SuperChatItem,
  SuperChatSummaryResponse,
  SuperChatsResponse,
} from "@/lib/api/revenue";

const MOCK_SUPER_CHATS: Omit<SuperChatItem, "jump_url">[] = [
  {
    time_in_seconds: 120,
    time_text: "2:00",
    author_name: "初見さん",
    amount: 500,
    currency: "JPY",
    message: "初見です！がんばれ",
  },
  {
    time_in_seconds: 600,
    time_text: "10:00",
    author_name: "viewer1",
    amount: 1000,
    currency: "JPY",
    message: "がんばれ",
  },
  {
    time_in_seconds: 1234,
    time_text: "20:34",
    author_name: "regular_user",
    amount: 2000,
    currency: "JPY",
    message: "ボス戦神プレイ",
  },
  {
    time_in_seconds: 1800,
    time_text: "30:00",
    author_name: "海外ファン",
    amount: 5,
    currency: "USD",
    message: "GG!",
  },
  {
    time_in_seconds: 2100,
    time_text: "35:00",
    author_name: "常連A",
    amount: 5000,
    currency: "JPY",
    message: "今日も最高",
  },
  {
    time_in_seconds: 2700,
    time_text: "45:00",
    author_name: "viewer2",
    amount: 300,
    currency: "JPY",
    message: "8888",
  },
  {
    time_in_seconds: 3600,
    time_text: "1:00:00",
    author_name: "スパチャ王",
    amount: 10000,
    currency: "JPY",
    message: "Phase2 期待してます",
  },
  {
    time_in_seconds: 3650,
    time_text: "1:00:50",
    author_name: "viewer3",
    amount: 1500,
    currency: "JPY",
    message: "わろた",
  },
  {
    time_in_seconds: 4200,
    time_text: "1:10:00",
    author_name: "regular_user",
    amount: 800,
    currency: "JPY",
    message: "神",
  },
  {
    time_in_seconds: 4800,
    time_text: "1:20:00",
    author_name: "viewer4",
    amount: 200,
    currency: "JPY",
    message: "お疲れ様",
  },
  {
    time_in_seconds: 5400,
    time_text: "1:30:00",
    author_name: "常連B",
    amount: 3000,
    currency: "JPY",
    message: "エンディングまで見ます",
  },
  {
    time_in_seconds: 6000,
    time_text: "1:40:00",
    author_name: "viewer5",
    amount: 500,
    currency: "JPY",
    message: "また来ます",
  },
];

function withJumpUrls(videoId: string): SuperChatItem[] {
  return MOCK_SUPER_CHATS.map((item) => ({
    ...item,
    jump_url: youtubeJumpUrl(videoId, item.time_in_seconds),
  }));
}

function buildTimeline(
  items: SuperChatItem[],
  bucketSec: number,
  durationSec: number,
): SuperChatSummaryResponse["timeline"] {
  const buckets: SuperChatSummaryResponse["timeline"] = [];
  for (let start = 0; start < durationSec; start += bucketSec) {
    const inBucket = items.filter(
      (item) =>
        item.time_in_seconds >= start &&
        item.time_in_seconds < start + bucketSec,
    );
    buckets.push({
      bucket_start_sec: start,
      count: inBucket.length,
      amount_jpy: inBucket.reduce(
        (sum, item) => sum + (item.currency === "JPY" ? item.amount : 0),
        0,
      ),
    });
  }
  return buckets;
}

function buildDensity(
  videoId: string,
  bucketSec: number,
  durationSec: number,
): DensityResponse {
  const buckets: DensityResponse["buckets"] = [];
  let total = 0;
  for (let start = 0; start < durationSec; start += bucketSec) {
    const base = 30 + Math.floor(Math.sin(start / 600) * 15);
    const peak =
      start >= 3500 && start < 4000 ? 90 : start >= 1200 && start < 1300 ? 70 : 0;
    const count = base + peak + Math.floor((start % 300) / 30);
    buckets.push({ bucket_start_sec: start, count });
    total += count;
  }
  return {
    video_id: videoId,
    bucket_sec: bucketSec,
    buckets,
    average_count: total / buckets.length,
  };
}

export function getMockSuperChatSummary(
  videoId: string,
): SuperChatSummaryResponse {
  const items = withJumpUrls(videoId);
  const jpyItems = items.filter((item) => item.currency === "JPY");
  const usdItems = items.filter((item) => item.currency === "USD");

  return {
    video_id: videoId,
    super_chat_status: "present",
    super_chat_status_message: null,
    by_currency: [
      {
        currency: "JPY",
        total_amount: jpyItems.reduce((sum, item) => sum + item.amount, 0),
        count: jpyItems.length,
      },
      {
        currency: "USD",
        total_amount: usdItems.reduce((sum, item) => sum + item.amount, 0),
        count: usdItems.length,
      },
    ],
    timeline: buildTimeline(items, 60, 6300),
  };
}

export function getMockSuperChats(
  videoId: string,
  page = 1,
  pageSize = 50,
): SuperChatsResponse {
  const allItems = withJumpUrls(videoId);
  const start = (page - 1) * pageSize;
  const items = allItems.slice(start, start + pageSize);

  return {
    video_id: videoId,
    items,
    pagination: {
      page,
      page_size: pageSize,
      total: allItems.length,
    },
  };
}

export function getMockDensity(videoId: string): DensityResponse {
  return buildDensity(videoId, 60, 6300);
}

export function getMockRevenueTabData(videoId: string): RevenueTabData {
  return {
    summary: getMockSuperChatSummary(videoId),
    superChats: getMockSuperChats(videoId),
    density: getMockDensity(videoId),
  };
}

/** Empty 状態の検証用（テスト・Story 向け） */
export function getMockEmptyRevenueTabData(videoId: string): RevenueTabData {
  return {
    summary: {
      video_id: videoId,
      super_chat_status: "none_in_chat",
      super_chat_status_message:
        "この配信では Super Chat / Super Thanks のデータが検出されませんでした。",
      by_currency: [],
      timeline: [],
    },
    superChats: {
      video_id: videoId,
      items: [],
      pagination: { page: 1, page_size: 50, total: 0 },
    },
    density: getMockDensity(videoId),
  };
}

export function formatMockBucketLabel(seconds: number): string {
  return formatSeconds(seconds);
}
