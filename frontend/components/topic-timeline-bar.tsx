"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { TopicLabelTokens } from "@/components/topic-label-tokens";
import type { TopicBlockPreview } from "@/lib/api";
import { formatSeconds } from "@/lib/format";
import { getTopicBlockColor } from "@/lib/topic-block-colors";

type TopicTimelineBarProps = {
  blocks: TopicBlockPreview[];
  durationSeconds?: number | null;
  interactiveLabels?: boolean;
  refilterPending?: boolean;
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

export function TopicTimelineBar({
  blocks,
  durationSeconds,
  interactiveLabels = false,
  refilterPending = false,
}: TopicTimelineBarProps) {
  if (blocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <SectionHeading title="構成タイムライン" refilterPending={refilterPending} />
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
        <SectionHeading title="構成タイムライン" refilterPending={refilterPending} />
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
            const color = getTopicBlockColor(index);

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
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {blocks.map((block, index) => (
            <li key={block.block_id} className="flex max-w-full items-start gap-1.5">
              <span
                className="mt-0.5 inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: getTopicBlockColor(index) }}
                aria-hidden
              />
              <TopicLabelTokens
                label={block.label}
                labelNote={block.label_note}
                interactive={interactiveLabels}
                showEstimatedBadge={false}
                className="min-w-0 text-xs text-muted-foreground"
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
