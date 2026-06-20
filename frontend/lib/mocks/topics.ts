import { youtubeJumpUrl } from "@/lib/format";
import type {
  KeywordsResponse,
  TopicBlock,
  TopicsResponse,
  TopicTransitionsResponse,
} from "@/lib/api";

function buildMockBlocks(videoId: string): TopicBlock[] {
  return [
    {
      block_id: "mock-block-0",
      block_index: 0,
      start_sec: 0,
      end_sec: 900,
      label: "オープニング / 雑談",
      label_note: "チャット上の推定話題",
      message_count: 1200,
      unique_authors: 300,
      super_chat_total: [{ currency: "JPY", amount: 500, count: 1 }],
      jump_url: youtubeJumpUrl(videoId, 0),
    },
    {
      block_id: "mock-block-1",
      block_index: 1,
      start_sec: 900,
      end_sec: 2100,
      label: "ボス戦 Phase 1",
      label_note: "チャット上の推定話題",
      message_count: 3400,
      unique_authors: 520,
      super_chat_total: [
        { currency: "JPY", amount: 3000, count: 2 },
        { currency: "USD", amount: 5, count: 1 },
      ],
      jump_url: youtubeJumpUrl(videoId, 900),
    },
    {
      block_id: "mock-block-2",
      block_index: 2,
      start_sec: 2100,
      end_sec: 3600,
      label: "雑談・質疑",
      label_note: "チャット上の推定話題",
      message_count: 1800,
      unique_authors: 410,
      super_chat_total: [],
      jump_url: youtubeJumpUrl(videoId, 2100),
    },
    {
      block_id: "mock-block-3",
      block_index: 3,
      start_sec: 3600,
      end_sec: 5400,
      label: "ボス戦 Phase 2",
      label_note: "チャット上の推定話題",
      message_count: 4200,
      unique_authors: 680,
      super_chat_total: [{ currency: "JPY", amount: 10000, count: 3 }],
      jump_url: youtubeJumpUrl(videoId, 3600),
    },
    {
      block_id: "mock-block-4",
      block_index: 4,
      start_sec: 5400,
      end_sec: 6300,
      label: "エンディング / お疲れ様",
      label_note: "チャット上の推定話題",
      message_count: 950,
      unique_authors: 280,
      super_chat_total: [{ currency: "JPY", amount: 2000, count: 1 }],
      jump_url: youtubeJumpUrl(videoId, 5400),
    },
  ];
}

export function getMockTopics(videoId: string): TopicsResponse {
  return {
    video_id: videoId,
    items: buildMockBlocks(videoId),
  };
}

export function getMockTopicTransitions(videoId: string): TopicTransitionsResponse {
  return {
    video_id: videoId,
    items: [
      {
        from_block_index: 0,
        from_label: "オープニング / 雑談",
        to_block_index: 1,
        to_label: "ボス戦 Phase 1",
        at_sec: 900,
      },
      {
        from_block_index: 1,
        from_label: "ボス戦 Phase 1",
        to_block_index: 2,
        to_label: "雑談・質疑",
        at_sec: 2100,
      },
      {
        from_block_index: 2,
        from_label: "雑談・質疑",
        to_block_index: 3,
        to_label: "ボス戦 Phase 2",
        at_sec: 3600,
      },
      {
        from_block_index: 3,
        from_label: "ボス戦 Phase 2",
        to_block_index: 4,
        to_label: "エンディング / お疲れ様",
        at_sec: 5400,
      },
    ],
  };
}

export function getMockKeywords(videoId: string): KeywordsResponse {
  const tokens = [
    "ボス",
    "草",
    "8888",
    "お疲れ様",
    "神",
    "わろた",
    "GG",
    "来た",
    "初見",
    "かわいい",
    "つよい",
    "ナイス",
    "ｗｗｗ",
    "助かる",
    "まじか",
    "最高",
    "感謝",
    "おめでとう",
    "頑張れ",
    "復活",
  ];

  return {
    video_id: videoId,
    overall: tokens.map((token, index) => ({
      token,
      count: 450 - index * 18,
      rank: index + 1,
    })),
  };
}

export function getMockTopicsTabData(videoId: string) {
  return {
    topics: getMockTopics(videoId),
    transitions: getMockTopicTransitions(videoId),
    keywords: getMockKeywords(videoId),
  };
}
