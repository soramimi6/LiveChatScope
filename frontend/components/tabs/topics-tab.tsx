"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KeywordBurstRanking } from "@/components/keyword-burst-ranking";
import { TopicBlockThumbnail } from "@/components/topic-block-thumbnail";
import { TopicTimelineBar } from "@/components/topic-timeline-bar";
import {
  getKeywordBurstsWithFallback,
  getTopicsTabDataWithFallback,
  type KeywordBurstsResponse,
  type SuperChatTotal,
  type TopicBlock,
  type TopicTransition,
  type TopicsTabData,
} from "@/lib/api";
import { formatSeconds } from "@/lib/format";

type TopicsTabProps = {
  videoId: string;
  durationSeconds?: number | null;
  refreshKey?: number;
};

function formatSuperChatTotals(totals: SuperChatTotal[]): string {
  if (totals.length === 0) return "—";
  return totals
    .map((t) => `${t.amount.toLocaleString()} ${t.currency}（${t.count}件）`)
    .join(" / ");
}

function EstimatedLabel({ block }: { block: TopicBlock }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span title={block.label_note}>{block.label}</span>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        推定
      </Badge>
    </div>
  );
}

function TopicBlocksTable({
  blocks,
  rowRefs,
  videoId,
}: {
  blocks: TopicBlock[];
  rowRefs: MutableRefObject<Record<string, HTMLTableRowElement | null>>;
  videoId: string;
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">話題ブロックがありません。</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium w-20">サムネイル</th>
            <th className="px-3 py-2 font-medium">開始 – 終了</th>
            <th className="px-3 py-2 font-medium">推定ラベル</th>
            <th className="px-3 py-2 font-medium tabular-nums">コメント</th>
            <th className="px-3 py-2 font-medium tabular-nums">ユニーク投稿者</th>
            <th className="px-3 py-2 font-medium">スパチャ</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr
              key={block.block_id}
              id={`topic-block-${block.block_id}`}
              ref={(el) => {
                rowRefs.current[block.block_id] = el;
              }}
              className="border-b last:border-b-0"
            >
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {block.block_index + 1}
              </td>
              <td className="px-2 py-2">
                <a
                  href={block.jump_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`YouTube ${formatSeconds(block.start_sec)} へジャンプ`}
                  className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <TopicBlockThumbnail
                    videoId={videoId}
                    startSec={block.start_sec}
                    label={block.label}
                  />
                </a>
              </td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {formatSeconds(block.start_sec)} – {formatSeconds(block.end_sec)}
              </td>
              <td className="px-3 py-2">
                <EstimatedLabel block={block} />
                <p className="mt-0.5 text-xs text-muted-foreground">{block.label_note}</p>
              </td>
              <td className="px-3 py-2 tabular-nums">
                {block.message_count.toLocaleString()}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {block.unique_authors.toLocaleString()}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatSuperChatTotals(block.super_chat_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransitionsTable({ items }: { items: TopicTransition[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">話題遷移データがありません。</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">遷移元</th>
            <th className="px-3 py-2 font-medium">遷移先</th>
            <th className="px-3 py-2 font-medium">切替時刻</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.from_block_index}-${item.to_block_index}-${index}`} className="border-b last:border-b-0">
              <td className="px-3 py-2">
                <span title="チャット上の推定話題">
                  {item.from_label}{" "}
                  <span className="text-muted-foreground">(推定)</span>
                </span>
              </td>
              <td className="px-3 py-2">
                <span title="チャット上の推定話題">
                  {item.to_label}{" "}
                  <span className="text-muted-foreground">(推定)</span>
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {formatSeconds(item.at_sec)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordsSection({ keywords }: { keywords: TopicsTabData["keywords"] }) {
  if (keywords.overall.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">キーワードデータがありません。</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.overall.map((kw) => (
        <Badge key={kw.rank} variant="secondary" className="text-sm">
          {kw.rank}. {kw.token}{" "}
          <span className="text-muted-foreground">({kw.count})</span>
        </Badge>
      ))}
    </div>
  );
}

export function TopicsTab({ videoId, durationSeconds, refreshKey = 0 }: TopicsTabProps) {
  const [data, setData] = useState<TopicsTabData | null>(null);
  const [bursts, setBursts] = useState<KeywordBurstsResponse | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([getTopicsTabDataWithFallback(videoId), getKeywordBurstsWithFallback(videoId)])
      .then(([tabResult, burstResult]) => {
        if (!cancelled) {
          setData(tabResult.data);
          setBursts(burstResult.data);
          setIsMock(tabResult.isMock || burstResult.isMock);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, refreshKey]);

  const scrollToBlock = (blockId: string) => {
    rowRefs.current[blockId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>話題分析を読み込めませんでした</AlertTitle>
        <AlertDescription>しばらくしてから再度お試しください。</AlertDescription>
      </Alert>
    );
  }

  const blocks = data.topics.items;

  return (
    <div className="space-y-6">
      {isMock ? (
        <Alert>
          <Info />
          <AlertTitle>サンプルデータを表示中</AlertTitle>
          <AlertDescription>API 未接続のため、見本データで画面を表示しています。</AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="構成タイムライン">
        <TopicTimelineBar blocks={blocks} durationSeconds={durationSeconds} />
        {blocks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {blocks.map((block) => (
              <button
                key={block.block_id}
                type="button"
                onClick={() => scrollToBlock(block.block_id)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={`${block.label_note} — 一覧の該当行へスクロール`}
              >
                {block.label}{" "}
                <span className="text-[10px]">(推定)</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>話題ブロック一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <TopicBlocksTable blocks={blocks} rowRefs={rowRefs} videoId={videoId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>話題遷移</CardTitle>
        </CardHeader>
        <CardContent>
          <TransitionsTable items={data.transitions.items} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>キーワード Top 20</CardTitle>
        </CardHeader>
        <CardContent>
          <KeywordsSection keywords={data.keywords} />
        </CardContent>
      </Card>

      {bursts ? <KeywordBurstRanking items={bursts.items} /> : null}
    </div>
  );
}
