import type {
  AuthorsByTopicResponse,
  AuthorsResponse,
  CommunityTabData,
} from "@/lib/api/community";
import { getMockTopics } from "@/lib/mocks/topics";

const MOCK_AUTHORS = [
  { author_id: "UC-mock-01", author_name: "たろう", message_count: 186, rank: 1, is_core_regular: true },
  { author_id: "UC-mock-02", author_name: "はなこ", message_count: 142, rank: 2, is_core_regular: true },
  { author_id: "UC-mock-03", author_name: "ゲーマー太郎", message_count: 128, rank: 3, is_core_regular: true },
  { author_id: "UC-mock-04", author_name: "初見さん", message_count: 95, rank: 4, is_core_regular: false },
  { author_id: "UC-mock-05", author_name: "スパチャ王", message_count: 88, rank: 5, is_core_regular: true },
  { author_id: "UC-mock-06", author_name: "草生える", message_count: 76, rank: 6, is_core_regular: false },
  { author_id: "UC-mock-07", author_name: "8888", message_count: 71, rank: 7, is_core_regular: true },
  { author_id: "UC-mock-08", author_name: "ボス攻略勢", message_count: 65, rank: 8, is_core_regular: true },
  { author_id: "UC-mock-09", author_name: "お疲れ様", message_count: 58, rank: 9, is_core_regular: false },
  { author_id: "UC-mock-10", author_name: "ナイス勢", message_count: 52, rank: 10, is_core_regular: false },
  { author_id: "UC-mock-11", author_name: "復活祈願", message_count: 48, rank: 11, is_core_regular: false },
  { author_id: "UC-mock-12", author_name: "雑談好き", message_count: 44, rank: 12, is_core_regular: true },
  { author_id: "UC-mock-13", author_name: "神プレイ", message_count: 41, rank: 13, is_core_regular: false },
  { author_id: "UC-mock-14", author_name: "わろた", message_count: 38, rank: 14, is_core_regular: false },
  { author_id: "UC-mock-15", author_name: "常連A", message_count: 35, rank: 15, is_core_regular: true },
  { author_id: "UC-mock-16", author_name: "常連B", message_count: 33, rank: 16, is_core_regular: true },
  { author_id: "UC-mock-17", author_name: "初見B", message_count: 30, rank: 17, is_core_regular: false },
  { author_id: "UC-mock-18", author_name: "応援団", message_count: 28, rank: 18, is_core_regular: false },
  { author_id: "UC-mock-19", author_name: "コメント勢", message_count: 25, rank: 19, is_core_regular: false },
  { author_id: "UC-mock-20", author_name: "見守り", message_count: 22, rank: 20, is_core_regular: false },
] as const;

const TOPIC_AUTHOR_PRESETS: Record<string, { author_name: string; message_count: number; rank: number }[]> = {
  "mock-block-0": [
    { author_name: "たろう", message_count: 42, rank: 1 },
    { author_name: "はなこ", message_count: 38, rank: 2 },
    { author_name: "雑談好き", message_count: 31, rank: 3 },
    { author_name: "初見さん", message_count: 24, rank: 4 },
    { author_name: "8888", message_count: 19, rank: 5 },
  ],
  "mock-block-1": [
    { author_name: "ボス攻略勢", message_count: 88, rank: 1 },
    { author_name: "たろう", message_count: 72, rank: 2 },
    { author_name: "ゲーマー太郎", message_count: 65, rank: 3 },
    { author_name: "8888", message_count: 58, rank: 4 },
    { author_name: "神プレイ", message_count: 51, rank: 5 },
  ],
  "mock-block-2": [
    { author_name: "雑談好き", message_count: 55, rank: 1 },
    { author_name: "はなこ", message_count: 48, rank: 2 },
    { author_name: "たろう", message_count: 40, rank: 3 },
    { author_name: "初見さん", message_count: 33, rank: 4 },
    { author_name: "わろた", message_count: 28, rank: 5 },
  ],
  "mock-block-3": [
    { author_name: "ボス攻略勢", message_count: 102, rank: 1 },
    { author_name: "ゲーマー太郎", message_count: 91, rank: 2 },
    { author_name: "8888", message_count: 84, rank: 3 },
    { author_name: "たろう", message_count: 76, rank: 4 },
    { author_name: "復活祈願", message_count: 68, rank: 5 },
  ],
  "mock-block-4": [
    { author_name: "お疲れ様", message_count: 45, rank: 1 },
    { author_name: "スパチャ王", message_count: 38, rank: 2 },
    { author_name: "たろう", message_count: 32, rank: 3 },
    { author_name: "はなこ", message_count: 29, rank: 4 },
    { author_name: "常連A", message_count: 24, rank: 5 },
  ],
};

export function getMockAuthors(videoId: string): AuthorsResponse {
  return {
    video_id: videoId,
    items: MOCK_AUTHORS.map((author) => ({ ...author })),
  };
}

export function getMockAuthorsByTopic(blockId: string): AuthorsByTopicResponse {
  const items = TOPIC_AUTHOR_PRESETS[blockId] ?? TOPIC_AUTHOR_PRESETS["mock-block-0"];

  return {
    block_id: blockId,
    items: items.map((item) => ({ ...item })),
  };
}

export function getMockCommunityTabData(videoId: string): CommunityTabData {
  return {
    authors: getMockAuthors(videoId),
    topics: getMockTopics(videoId),
  };
}
