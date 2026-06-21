"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { JumpLinkButton } from "@/components/jump-link-button";
import { TopicLabelTokens } from "@/components/topic-label-tokens";
import type { TopicBlock } from "@/lib/api";
import { formatSeconds } from "@/lib/format";
import {
  formatSuperChatTotals,
  rankTopicsBySuperChat,
} from "@/lib/topic-super-chat";

type TopicSuperChatRankingProps = {
  blocks: TopicBlock[];
  limit?: number;
  title?: string;
  refilterPending?: boolean;
  interactiveLabels?: boolean;
};

export function TopicSuperChatRanking({
  blocks,
  limit = 5,
  title,
  refilterPending = false,
  interactiveLabels = true,
}: TopicSuperChatRankingProps) {
  const ranked = rankTopicsBySuperChat(blocks, limit);
  const cardTitle = title ?? `スパチャが集中した話題 Top ${limit}`;

  return (
    <Card>
      <CardHeader>
        <SectionHeading title={cardTitle} refilterPending={refilterPending} />
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            話題ブロックごとのスパチャはありません。
          </p>
        ) : (
          <ol className="space-y-3">
            {ranked.map((row, index) => (
              <li
                key={row.block.block_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium tabular-nums">{index + 1}.</p>
                    <TopicLabelTokens
                      label={row.block.label}
                      labelNote={row.block.label_note}
                      interactive={interactiveLabels}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatSeconds(row.block.start_sec)} –{" "}
                    {formatSeconds(row.block.end_sec)}
                  </p>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">
                    {formatSuperChatTotals(row.totals)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    合計 {row.totalCount} 件
                  </p>
                </div>
                <JumpLinkButton
                  jumpUrl={row.block.jump_url}
                  timeText={formatSeconds(row.block.start_sec)}
                  size="xs"
                />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
