"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JumpLinkButton } from "@/components/jump-link-button";
import type { KeywordBurst } from "@/lib/api";

type KeywordBurstRankingProps = {
  items: KeywordBurst[];
  title?: string;
};

export function KeywordBurstRanking({
  items,
  title = "急上昇キーワード Top 10",
}: KeywordBurstRankingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            急上昇キーワードは検出されませんでした。
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li
                key={`${item.token}-${item.peak_bucket_start_sec}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium tabular-nums">
                    {item.rank}. {item.token}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.time_text} · {item.peak_count.toLocaleString()} 件
                    （前 {item.baseline_count.toLocaleString()} 件 →{" "}
                    {item.burst_ratio.toLocaleString()} 倍）
                  </p>
                </div>
                <JumpLinkButton jumpUrl={item.jump_url} timeText={item.time_text} size="xs" />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
