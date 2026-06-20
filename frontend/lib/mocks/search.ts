import { formatSeconds, youtubeJumpUrl } from "@/lib/format";
import type { MessageItem, MessagesResponse } from "@/lib/api/search";

const MOCK_AUTHORS = [
  "視聴者A",
  "視聴者B",
  "常連太郎",
  "初見さん",
  "スパチャ王",
] as const;

const MOCK_TEXTS = [
  "こんにちは！初見です",
  "ボス戦きたーー",
  "8888888888",
  "草",
  "神プレイ",
  "お疲れ様でした",
  "次回も楽しみ",
  "わろた",
  "GG",
  "来た来た",
  "ボス弱くない？",
  "初見だけど面白い",
  "スパチャ送ります",
  "かわいい",
  "今日も配信ありがとう",
  "ボス倒した！",
  "まだ見てる",
  "アーカイブ待ち",
  "神",
  "はいはい",
] as const;

const MESSAGE_TYPES = [
  "text_message",
  "text_message",
  "text_message",
  "text_message",
  "super_chat",
  "super_sticker",
  "system",
] as const;

function buildMockMessages(videoId: string): MessageItem[] {
  const items: MessageItem[] = [];

  for (let i = 0; i < 120; i++) {
    const timeInSeconds = i * 45 + (i % 7) * 3;
    const author = MOCK_AUTHORS[i % MOCK_AUTHORS.length];
    const messageType = MESSAGE_TYPES[i % MESSAGE_TYPES.length];
    const baseText = MOCK_TEXTS[i % MOCK_TEXTS.length];
    const text =
      messageType === "super_chat"
        ? `${baseText}（¥${(i + 1) * 100}）`
        : messageType === "system"
          ? `[システム] ${baseText}`
          : baseText;

    items.push({
      message_id: `mock-msg-${i}`,
      time_in_seconds: timeInSeconds,
      time_text: formatSeconds(timeInSeconds),
      author_name: author,
      message_type: messageType,
      text,
      jump_url: youtubeJumpUrl(videoId, timeInSeconds),
    });
  }

  return items;
}

const mockCache = new Map<string, MessageItem[]>();

function getAllMockMessages(videoId: string): MessageItem[] {
  let items = mockCache.get(videoId);
  if (!items) {
    items = buildMockMessages(videoId);
    mockCache.set(videoId, items);
  }
  return items;
}

export type MockSearchParams = {
  q?: string;
  author?: string;
  message_type?: string;
  page?: number;
  page_size?: number;
};

/** api-spec GET /messages の形状に沿ったサンプル（フィルタ・ページング対応） */
export function getMockMessages(
  videoId: string,
  params: MockSearchParams = {},
): MessagesResponse {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 50;
  let items = getAllMockMessages(videoId);

  if (params.q?.trim()) {
    const needle = params.q.trim().toLowerCase();
    items = items.filter((item) => item.text.toLowerCase().includes(needle));
  }

  if (params.author?.trim()) {
    const author = params.author.trim();
    items = items.filter((item) => item.author_name === author);
  }

  if (params.message_type?.trim()) {
    const messageType = params.message_type.trim();
    items = items.filter((item) => item.message_type === messageType);
  }

  const total = items.length;
  const offset = (page - 1) * pageSize;
  const pageItems = items.slice(offset, offset + pageSize);

  return {
    video_id: videoId,
    items: pageItems,
    pagination: { page, page_size: pageSize, total },
  };
}
