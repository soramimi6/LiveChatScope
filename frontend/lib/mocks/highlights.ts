import { youtubeJumpUrl } from "@/lib/format";
import type {
  DensityResponse,
  HighlightsResponse,
  HighlightsTabData,
  LowActivityResponse,
} from "@/lib/api/highlights";

const HIGHLIGHT_PEAKS = [
  { rank: 1, time_in_seconds: 1234.5, score: 3.2 },
  { rank: 2, time_in_seconds: 3650, score: 2.9 },
  { rank: 3, time_in_seconds: 890, score: 2.5 },
  { rank: 4, time_in_seconds: 4520, score: 2.3 },
  { rank: 5, time_in_seconds: 2100, score: 2.1 },
  { rank: 6, time_in_seconds: 5100, score: 1.9 },
  { rank: 7, time_in_seconds: 600, score: 1.8 },
  { rank: 8, time_in_seconds: 2800, score: 1.7 },
  { rank: 9, time_in_seconds: 4000, score: 1.6 },
  { rank: 10, time_in_seconds: 5700, score: 1.5 },
];

const CLIP_PADDING_SEC = 30;

function formatTimeText(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildDensityBuckets(): DensityResponse["buckets"] {
  const buckets: DensityResponse["buckets"] = [];
  const bucketSec = 60;

  for (let start = 0; start < 6300; start += bucketSec) {
    let count = 35 + Math.floor(Math.sin(start / 400) * 10);

    for (const peak of HIGHLIGHT_PEAKS) {
      const distance = Math.abs(start + bucketSec / 2 - peak.time_in_seconds);
      if (distance < 120) {
        count += Math.round((120 - distance) * 0.8);
      }
    }

    buckets.push({
      bucket_start_sec: start,
      count: Math.max(8, count),
    });
  }

  return buckets;
}

export function getMockDensity(videoId: string): DensityResponse {
  const buckets = buildDensityBuckets();
  const average =
    buckets.reduce((sum, bucket) => sum + bucket.count, 0) / buckets.length;

  return {
    video_id: videoId,
    bucket_sec: 60,
    buckets,
    average_count: Math.round(average * 10) / 10,
  };
}

export function getMockHighlights(videoId: string): HighlightsResponse {
  return {
    video_id: videoId,
    items: HIGHLIGHT_PEAKS.map((peak) => ({
      rank: peak.rank,
      time_in_seconds: peak.time_in_seconds,
      time_text: formatTimeText(peak.time_in_seconds),
      score: peak.score,
      clip_start_sec: Math.max(0, Math.floor(peak.time_in_seconds) - CLIP_PADDING_SEC),
      clip_end_sec: Math.floor(peak.time_in_seconds) + CLIP_PADDING_SEC,
      jump_url: youtubeJumpUrl(videoId, peak.time_in_seconds),
      context:
        peak.rank <= 3
          ? {
              sample_messages: [
                {
                  author_name: "たろう",
                  text: "うおおおお！",
                  time_in_seconds: peak.time_in_seconds - 5,
                  time_text: formatTimeText(peak.time_in_seconds - 5),
                },
              ],
              top_authors: [
                {
                  author_id: "UC-mock-01",
                  author_name: "たろう",
                  message_count: 12,
                },
              ],
            }
          : undefined,
    })),
  };
}

export function getMockLowActivity(videoId: string): LowActivityResponse {
  return {
    video_id: videoId,
    items: [
      {
        start_sec: 1800,
        end_sec: 2100,
        duration_sec: 300,
        avg_density: 12.3,
        start_jump_url: youtubeJumpUrl(videoId, 1800),
      },
      {
        start_sec: 4800,
        end_sec: 5100,
        duration_sec: 300,
        avg_density: 10.8,
        start_jump_url: youtubeJumpUrl(videoId, 4800),
      },
    ],
  };
}

export function getMockHighlightsTabData(videoId: string): HighlightsTabData {
  return {
    density: getMockDensity(videoId),
    highlights: getMockHighlights(videoId),
    lowActivity: getMockLowActivity(videoId),
  };
}
