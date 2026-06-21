"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type TimelineTooltipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  blocks: TopicBlockPreview[];
};

function TimelineTooltip({ active, payload, blocks }: TimelineTooltipProps) {
  if (!active || !payload?.length) return null;

  const entry = payload.find((p) => p.value && p.value > 0);
  if (!entry?.dataKey) return null;

  const index = Number(String(entry.dataKey).replace("block_", ""));
  const block = blocks[index];
  if (!block) return null;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{block.label}</p>
      <p className="text-muted-foreground">
        {formatSeconds(block.start_sec)} – {formatSeconds(block.end_sec)}
      </p>
      <p className="text-muted-foreground">
        {block.message_count.toLocaleString()} 件 / ユニーク投稿者{" "}
        {block.unique_authors.toLocaleString()}
      </p>
    </div>
  );
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

  const stackRow: Record<string, number> = {};
  blocks.forEach((block, index) => {
    stackRow[`block_${index}`] = Math.max(block.end_sec - block.start_sec, 0);
  });

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.round(totalDuration * ratio),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>構成タイムライン</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-16 w-full" aria-label="配信構成タイムライン">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={[stackRow]}
              margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, totalDuration || 1]}
                ticks={ticks}
                tickFormatter={formatAxisMinutes}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="category" dataKey="name" hide width={0} />
              <Tooltip
                content={<TimelineTooltip blocks={blocks} />}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              {blocks.map((block, index) => (
                <Bar
                  key={block.block_id}
                  dataKey={`block_${index}`}
                  stackId="timeline"
                  fill={BLOCK_COLORS[index % BLOCK_COLORS.length]}
                  radius={
                    index === 0
                      ? [4, 0, 0, 4]
                      : index === blocks.length - 1
                        ? [0, 4, 4, 0]
                        : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
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
