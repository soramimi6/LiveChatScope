"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JumpLinkButton } from "@/components/jump-link-button";
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
};

export function TopicSuperChatRanking({
  blocks,
  limit = 5,
  title,
}: TopicSuperChatRankingProps) {
  const ranked = rankTopicsBySuperChat(blocks, limit);
  const cardTitle = title ?? `スパチャが集中した話題 Top ${limit}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
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
                    <p className="font-medium tabular-nums">
                      {index + 1}. {row.block.label}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      推定
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatSeconds(row.block.start_sec)} –{" "}
                    {formatSeconds(row.block.end_sec)} ·{" "}
                    {formatSuperChatTotals(row.totals)}（合計 {row.totalCount} 件）
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
