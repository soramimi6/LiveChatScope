"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JumpLinkButton } from "@/components/jump-link-button";
import { KpiCard } from "@/components/kpi-card";
import { TopicTimelineBar } from "@/components/topic-timeline-bar";
import { getSummaryWithFallback, type SummaryResponse } from "@/lib/api";

type SummaryTabProps = {
  videoId: string;
  durationSeconds?: number | null;
  refreshKey?: number;
};

function formatSuperChatTotals(totals: SummaryResponse["super_chat_total"]): string {
  if (totals.length === 0) return "—";
  return totals
    .map((t) => `${t.amount.toLocaleString()} ${t.currency}（${t.count}件）`)
    .join(" / ");
}

export function SummaryTab({ videoId, durationSeconds, refreshKey = 0 }: SummaryTabProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getSummaryWithFallback(videoId)
      .then(({ data, isMock: mock }) => {
        if (!cancelled) {
          setSummary(data);
          setIsMock(mock);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert variant="destructive">
        <AlertTitle>サマリーを読み込めませんでした</AlertTitle>
        <AlertDescription>しばらくしてから再度お試しください。</AlertDescription>
      </Alert>
    );
  }

  const keywordChartData = summary.top_keywords.map((kw) => ({
    token: kw.token,
    count: kw.count,
  }));

  return (
    <div className="space-y-6">
      {isMock ? (
        <Alert>
          <Info />
          <AlertTitle>サンプルデータを表示中</AlertTitle>
          <AlertDescription>API 未接続のため、見本データで画面を表示しています。</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="KPI">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="総コメント"
            value={summary.message_count.toLocaleString()}
          />
          <KpiCard
            title="ユニーク投稿者"
            value={summary.unique_authors.toLocaleString()}
          />
          <KpiCard
            title="ピーク時刻"
            value={summary.peak.time_text}
            description={`密度 ${summary.peak.density.toLocaleString()} 件/分`}
          />
          <KpiCard
            title="スパチャ合計"
            value={formatSuperChatTotals(summary.super_chat_total)}
          />
          <KpiCard
            title="話題数"
            value={summary.topic_block_count.toLocaleString()}
          />
        </div>
      </section>

      <TopicTimelineBar
        blocks={summary.topic_blocks_preview}
        durationSeconds={durationSeconds}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 盛り上がり</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.top_highlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">盛り上がり候補がありません。</p>
            ) : (
              <ol className="space-y-3">
                {summary.top_highlights.map((item) => (
                  <li
                    key={item.rank}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">
                        {item.rank}. {item.time_text}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        スコア {item.score.toFixed(1)}
                      </p>
                    </div>
                    <JumpLinkButton jumpUrl={item.jump_url} timeText={item.time_text} />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top キーワード</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {summary.top_keywords.map((kw) => (
                <Badge key={kw.rank} variant="secondary">
                  {kw.rank}. {kw.token}{" "}
                  <span className="text-muted-foreground">({kw.count})</span>
                </Badge>
              ))}
            </div>
            {keywordChartData.length > 0 ? (
              <div className="h-48 w-full" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={keywordChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="token"
                      width={72}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} 件`, "出現数"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            <table className="sr-only">
              <caption>Top キーワード（アクセシビリティ用）</caption>
              <thead>
                <tr>
                  <th>順位</th>
                  <th>キーワード</th>
                  <th>件数</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_keywords.map((kw) => (
                  <tr key={kw.rank}>
                    <td>{kw.rank}</td>
                    <td>{kw.token}</td>
                    <td>{kw.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <section aria-label="話題スコアカード">
        <h3 className="mb-3 text-sm font-medium">話題スコアカード</h3>
        {summary.topic_blocks_preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">話題ブロックがありません。</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {summary.topic_blocks_preview.map((block) => (
              <Card key={block.block_id} className="min-w-[16rem] shrink-0">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm leading-snug">{block.label}</CardTitle>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      推定
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{block.label_note}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">コメント</dt>
                      <dd className="font-medium tabular-nums">
                        {block.message_count.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">ユニーク</dt>
                      <dd className="font-medium tabular-nums">
                        {block.unique_authors.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <JumpLinkButton jumpUrl={block.jump_url} timeText={block.label} size="xs" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
