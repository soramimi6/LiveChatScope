"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/chart-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JumpLinkButton } from "@/components/jump-link-button";
import { DensityYScaleToggle } from "@/components/density-y-scale-toggle";
import {
  getHighlightsTabDataWithFallback,
  getMarkdownClipsWithFallback,
  type HighlightItem,
  type HighlightsTabData,
  type LowActivityItem,
} from "@/lib/api/highlights";
import { formatSeconds, formatStreamPosition } from "@/lib/format";
import {
  commentsPerMinute,
  formatRatePerMin,
} from "@/lib/density-chart";
import {
  densityRateForEmphasisScale,
  densityRateForLogScale,
  densityYScaleLabel,
  formatYAxisTickForScale,
  rechartsYAxisScale,
  yAxisDomain,
  yScaleSeriesKey,
  type DensityYScale,
} from "@/lib/density-y-scale";
import { useDensityYScale } from "@/lib/use-density-y-scale";

type HighlightsTabProps = {
  videoId: string;
  durationSeconds?: number | null;
};

type DensityChartPoint = {
  bucket_start_sec: number;
  count: number;
  ratePerMin: number;
  logRatePerMin: number;
  emphRatePerMin: number;
  timeLabel: string;
};

function chartRateValue(point: DensityChartPoint, yScale: DensityYScale): number {
  return yScaleSeriesKey(yScale, {
    linear: point.ratePerMin,
    log: point.logRatePerMin,
    emphasis: point.emphRatePerMin,
  });
}

function findBucketRatePerMin(
  buckets: DensityChartPoint[],
  timeSec: number,
  yScale: DensityYScale,
): number {
  if (buckets.length === 0) return 0;

  let nearest = buckets[0];
  let minDistance = Math.abs(nearest.bucket_start_sec - timeSec);

  for (const bucket of buckets) {
    const distance = Math.abs(bucket.bucket_start_sec - timeSec);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = bucket;
    }
  }

  return chartRateValue(nearest, yScale);
}

function HighlightsList({
  items,
  durationSeconds,
}: {
  items: HighlightItem[];
  durationSeconds?: number | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">盛り上がり候補がありません。</p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const streamPosition = formatStreamPosition(
          item.time_in_seconds,
          durationSeconds,
        );
        const sampleMessages = item.context?.sample_messages.slice(0, 3) ?? [];
        const topAuthors = item.context?.top_authors ?? [];

        return (
          <li key={item.rank} className="rounded-lg border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
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
                  <span
                    className="ml-1 inline-flex align-middle text-muted-foreground"
                    title="スコア = その時刻のコメント密度 ÷ 移動平均（約5分窓）。1.0 は平均並み、1.5 以上で候補に採用。"
                    aria-label="スコアの見方"
                  >
                    <Info className="size-3.5" />
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  切り抜き範囲（±30秒）: {formatSeconds(item.clip_start_sec)} –{" "}
                  {formatSeconds(item.clip_end_sec)}
                </p>
              </div>
              <JumpLinkButton jumpUrl={item.jump_url} timeText={item.time_text} />
            </div>

            {sampleMessages.length > 0 ? (
              <div className="mt-3 space-y-1.5 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">周辺コメント</p>
                <ul className="space-y-1">
                  {sampleMessages.map((msg, index) => (
                    <li
                      key={`${item.rank}-${msg.time_in_seconds}-${index}`}
                      className="text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{msg.author_name}</span>
                      <span className="mx-1 tabular-nums">{msg.time_text}</span>
                      <span>{msg.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {topAuthors.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                活発な投稿者:{" "}
                {topAuthors
                  .map((author) => `${author.author_name}（${author.message_count}件）`)
                  .join("、")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function LowActivityList({ items }: { items: LowActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">低活動区間は検出されませんでした。</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">開始 – 終了</th>
            <th className="px-3 py-2 font-medium tabular-nums">長さ</th>
            <th className="px-3 py-2 font-medium tabular-nums">平均密度</th>
            <th className="px-3 py-2 font-medium">ジャンプ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.start_sec}-${item.end_sec}`}
              className="border-b last:border-b-0"
            >
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {formatSeconds(item.start_sec)} – {formatSeconds(item.end_sec)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatSeconds(item.duration_sec)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {item.avg_density.toFixed(1)} 件/分
              </td>
              <td className="px-3 py-2">
                <JumpLinkButton
                  jumpUrl={item.start_jump_url}
                  timeText={formatSeconds(item.start_sec)}
                  size="xs"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DensityChart({
  data,
  highlights,
  lowActivity,
  averageRatePerMin,
  yScale,
}: {
  data: DensityChartPoint[];
  highlights: HighlightItem[];
  lowActivity: LowActivityItem[];
  averageRatePerMin: number;
  yScale: DensityYScale;
}) {
  const lineDataKey = yScaleSeriesKey(yScale, {
    linear: "ratePerMin",
    log: "logRatePerMin",
    emphasis: "emphRatePerMin",
  });

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">密度データがありません。</p>
    );
  }

  return (
    <div>
      <ChartContainer className="h-72 w-full" aria-label="コメント密度グラフ">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="bucket_start_sec"
            tickFormatter={(value) => formatSeconds(Number(value))}
            tick={{ fontSize: 11 }}
            minTickGap={32}
          />
          <YAxis
            scale={rechartsYAxisScale(yScale)}
            domain={yAxisDomain(yScale, densityRateForLogScale(0))}
            allowDataOverflow
            tick={{ fontSize: 11 }}
            width={48}
            tickFormatter={(value) =>
              formatYAxisTickForScale(Number(value), yScale)
            }
            label={{
              value: "件/分",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11 },
            }}
          />
          <Tooltip
            labelFormatter={(value) => `開始 ${formatSeconds(Number(value))}`}
            formatter={(_value, _name, item) => {
              const payload = item.payload as DensityChartPoint;
              return [formatRatePerMin(payload.ratePerMin), "コメント密度"];
            }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          {lowActivity.map((segment) => (
            <ReferenceArea
              key={`${segment.start_sec}-${segment.end_sec}`}
              x1={segment.start_sec}
              x2={segment.end_sec}
              fill="var(--chart-low-activity)"
              strokeOpacity={0}
            />
          ))}
          <Line
            type="monotone"
            dataKey={lineDataKey}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {highlights.map((item) => (
            <ReferenceDot
              key={item.rank}
              x={item.time_in_seconds}
              y={findBucketRatePerMin(data, item.time_in_seconds, yScale)}
              r={5}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ChartContainer>
      <p className="mt-2 text-xs text-muted-foreground">
        平均密度 {averageRatePerMin.toFixed(1)} 件/分 · 縦軸 {densityYScaleLabel(yScale)} ·
        赤点 = 盛り上がり候補 · 赤帯 = 低活動区間
      </p>
    </div>
  );
}

export function HighlightsTab({ videoId, durationSeconds }: HighlightsTabProps) {
  const [yScale, setYScale] = useDensityYScale("highlights-density");
  const [data, setData] = useState<HighlightsTabData | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getHighlightsTabDataWithFallback(videoId)
      .then(({ data: tabData, isMock: mock }) => {
        if (!cancelled) {
          setData(tabData);
          setIsMock(mock);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const chartData = useMemo<DensityChartPoint[]>(() => {
    if (!data) return [];
    const bucketSec = data.density.bucket_sec;
    return data.density.buckets.map((bucket) => {
      const ratePerMin = commentsPerMinute(bucket.count, bucketSec);
      return {
        bucket_start_sec: bucket.bucket_start_sec,
        count: bucket.count,
        ratePerMin,
        logRatePerMin: densityRateForLogScale(ratePerMin),
        emphRatePerMin: densityRateForEmphasisScale(ratePerMin),
        timeLabel: formatSeconds(bucket.bucket_start_sec),
      };
    });
  }, [data]);

  const averageRatePerMin = useMemo(() => {
    if (!data) return 0;
    return commentsPerMinute(data.density.average_count, data.density.bucket_sec);
  }, [data]);

  const handleCopyMarkdown = async () => {
    if (!data) return;

    try {
      const markdown = await getMarkdownClipsWithFallback(
        videoId,
        data.highlights.items,
      );
      await navigator.clipboard.writeText(markdown);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>盛り上がり分析を読み込めませんでした</AlertTitle>
        <AlertDescription>しばらくしてから再度お試しください。</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {isMock ? (
        <Alert>
          <Info />
          <AlertTitle>サンプルデータを表示中</AlertTitle>
          <AlertDescription>API 未接続のため、見本データで画面を表示しています。</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>コメント密度</CardTitle>
            <DensityYScaleToggle value={yScale} onChange={setYScale} />
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
            {copyState === "copied" ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {copyState === "copied"
              ? "コピーしました"
              : copyState === "error"
                ? "コピーに失敗"
                : "切り抜き候補を Markdown でコピー"}
          </Button>
        </CardHeader>
        <CardContent>
          <DensityChart
            data={chartData}
            highlights={data.highlights.items}
            lowActivity={data.lowActivity.items}
            averageRatePerMin={averageRatePerMin}
            yScale={yScale}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>盛り上がり候補</CardTitle>
        </CardHeader>
        <CardContent>
          <HighlightsList
            items={data.highlights.items}
            durationSeconds={durationSeconds}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>低活動区間</CardTitle>
        </CardHeader>
        <CardContent>
          <LowActivityList items={data.lowActivity.items} />
        </CardContent>
      </Card>
    </div>
  );
}
