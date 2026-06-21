"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopicBlockPreview } from "@/lib/api";
import { formatSeconds } from "@/lib/format";

const BLOCK_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

type TopicTimelineBarProps = {
  blocks: TopicBlockPreview[];
  durationSeconds?: number | null;
};

function formatAxisMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h${rem}m` : `${h}h`;
  }
  return `${m}分`;
}

export function TopicTimelineBar({ blocks, durationSeconds }: TopicTimelineBarProps) {
  if (blocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>構成タイムライン</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">話題ブロックデータがありません。</p>
        </CardContent>
      </Card>
    );
  }

  const totalDuration =
    durationSeconds ?? Math.max(...blocks.map((b) => b.end_sec), 0);
  const axisMax = totalDuration || 1;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.round(axisMax * ratio),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>構成タイムライン</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="relative h-4 w-full overflow-hidden rounded-md bg-muted"
          aria-label="配信構成タイムライン"
          data-testid="timeline-track"
        >
          {blocks.map((block, index) => {
            const leftPct = (block.start_sec / axisMax) * 100;
            const widthPct =
              (Math.max(block.end_sec - block.start_sec, 0) / axisMax) * 100;
            const color = BLOCK_COLORS[index % BLOCK_COLORS.length];

            return (
              <div
                key={block.block_id}
                data-testid="timeline-segment"
                className="absolute top-0 h-full min-w-px"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: color,
                }}
                title={`${block.label} (${formatSeconds(block.start_sec)} – ${formatSeconds(block.end_sec)})`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
          {ticks.map((tick) => (
            <span key={tick}>{formatAxisMinutes(tick)}</span>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {blocks.map((block, index) => (
            <li key={block.block_id} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: BLOCK_COLORS[index % BLOCK_COLORS.length] }}
              />
              <span className="truncate max-w-[12rem]">{block.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
