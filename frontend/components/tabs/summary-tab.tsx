"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/chart-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { JumpLinkButton } from "@/components/jump-link-button";
import { KeywordBurstRanking } from "@/components/keyword-burst-ranking";
import { KpiCard } from "@/components/kpi-card";
import { TopicBlockThumbnail } from "@/components/topic-block-thumbnail";
import { TopicTimelineBar } from "@/components/topic-timeline-bar";
import { TopicSuperChatRanking } from "@/components/topic-super-chat-ranking";
import {
  getKeywordBurstsWithFallback,
  getSummaryWithFallback,
  getTopicsWithFallback,
  type KeywordBurstsResponse,
  type SummaryResponse,
  type TopicBlock,
  type TopicBlockPreview,
  type TopicsResponse,
} from "@/lib/api";
import { formatStreamPosition } from "@/lib/format";
import { formatSuperChatTotals } from "@/lib/topic-super-chat";

function topicBlockToPreview(block: TopicBlock): TopicBlockPreview {
  return {
    block_id: block.block_id,
    block_index: block.block_index,
    start_sec: block.start_sec,
    end_sec: block.end_sec,
    label: block.label,
    label_note: block.label_note,
    message_count: block.message_count,
    unique_authors: block.unique_authors,
    jump_url: block.jump_url,
  };
}

type SummaryTabProps = {
  videoId: string;
  durationSeconds?: number | null;
  refreshKey?: number;
  refilterPending?: boolean;
};

export function SummaryTab({
  videoId,
  durationSeconds,
  refreshKey = 0,
  refilterPending = false,
}: SummaryTabProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [topics, setTopics] = useState<TopicsResponse | null>(null);
  const [bursts, setBursts] = useState<KeywordBurstsResponse | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getSummaryWithFallback(videoId),
      getTopicsWithFallback(videoId),
      getKeywordBurstsWithFallback(videoId),
    ])
      .then(([summaryResult, topicsResult, burstResult]) => {
        if (!cancelled) {
          setSummary(summaryResult.data);
          setTopics(topicsResult.data);
          setBursts(burstResult.data);
          setIsMock(
            summaryResult.isMock || topicsResult.isMock || burstResult.isMock,
          );
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
          <Skeleton className="h-24 w-full rounded-xl sm:col-span-2 lg:col-span-2" />
          <Skeleton className="h-24 w-full rounded-xl" />
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

  const timelineBlocks: TopicBlockPreview[] =
    topics && topics.items.length > 0
      ? topics.items.map(topicBlockToPreview)
      : summary.topic_blocks_preview;

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
            className="sm:col-span-2 lg:col-span-2"
          />
          <KpiCard
            title="話題数"
            value={summary.topic_block_count.toLocaleString()}
          />
        </div>
      </section>

      <TopicTimelineBar
        blocks={timelineBlocks}
        durationSeconds={durationSeconds}
        interactiveLabels={!isMock}
        refilterPending={refilterPending}
      />

      {topics ? (
        <TopicSuperChatRanking blocks={topics.items} refilterPending={refilterPending} interactiveLabels={!isMock} />
      ) : null}

      {bursts ? (
        <KeywordBurstRanking items={bursts.items} refilterPending={refilterPending} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionHeading title="Top 盛り上がり" refilterPending={refilterPending} />
          </CardHeader>
          <CardContent>
            {summary.top_highlights.length === 0 ? (
              <p className="text-sm text-muted-foreground">盛り上がり候補がありません。</p>
            ) : (
              <ol className="space-y-3">
                {summary.top_highlights.map((item) => {
                  const streamPosition = formatStreamPosition(
                    item.time_in_seconds,
                    durationSeconds,
                  );
                  return (
                  <li
                    key={item.rank}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">
                        {item.rank}. {item.time_text}
                        {streamPosition.percent != null ? (
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            {streamPosition.text}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        スコア {item.score.toFixed(1)}
                      </p>
                    </div>
                    <JumpLinkButton jumpUrl={item.jump_url} timeText={item.time_text} />
                  </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeading title="Top キーワード" refilterPending={refilterPending} />
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
              <ChartContainer className="h-48 w-full" aria-hidden>
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
              </ChartContainer>
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
        <SectionHeading
          title="話題スコアカード"
          as="section"
          refilterPending={refilterPending}
          className="mb-3"
        />
        {summary.topic_blocks_preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">話題ブロックがありません。</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {summary.topic_blocks_preview.map((block) => (
              <Card key={block.block_id} className="min-w-[16rem] shrink-0 overflow-hidden">
                <TopicBlockThumbnail
                  videoId={videoId}
                  startSec={block.start_sec}
                  label={block.label}
                  className="w-full rounded-none border-0 border-b"
                />
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
