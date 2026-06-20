"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Info } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JumpLinkButton } from "@/components/jump-link-button";
import {
  getHighlightsTabDataWithFallback,
  getMarkdownClipsWithFallback,
  type HighlightItem,
  type HighlightsTabData,
  type LowActivityItem,
} from "@/lib/api/highlights";
import { formatSeconds } from "@/lib/format";

type HighlightsTabProps = {
  videoId: string;
};

type DensityChartPoint = {
  bucket_start_sec: number;
  count: number;
  timeLabel: string;
};

function findBucketCount(
  buckets: DensityChartPoint[],
  timeSec: number,
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

  return nearest.count;
}

function HighlightsList({ items }: { items: HighlightItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">盛り上がり候補がありません。</p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li
          key={item.rank}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-medium tabular-nums">
              {item.rank}. {item.time_text}
            </p>
            <p className="text-xs text-muted-foreground">
              スコア {item.score.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">
              切り抜き範囲（±30秒）: {formatSeconds(item.clip_start_sec)} –{" "}
              {formatSeconds(item.clip_end_sec)}
            </p>
          </div>
          <JumpLinkButton jumpUrl={item.jump_url} timeText={item.time_text} />
        </li>
      ))}
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
  averageCount,
}: {
  data: DensityChartPoint[];
  highlights: HighlightItem[];
  lowActivity: LowActivityItem[];
  averageCount: number;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">密度データがありません。</p>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="コメント密度グラフ">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="bucket_start_sec"
            tickFormatter={(value) => formatSeconds(Number(value))}
            tick={{ fontSize: 11 }}
            minTickGap={32}
          />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip
            labelFormatter={(value) => `開始 ${formatSeconds(Number(value))}`}
            formatter={(value) => [`${value} 件`, "コメント数"]}
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
              fill="hsl(var(--muted))"
              fillOpacity={0.45}
              strokeOpacity={0}
            />
          ))}
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          {highlights.map((item) => (
            <ReferenceDot
              key={item.rank}
              x={item.time_in_seconds}
              y={findBucketCount(data, item.time_in_seconds)}
              r={5}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">
        平均密度 {averageCount.toFixed(1)} 件/バケット · 赤点 = 盛り上がり候補 · 灰色帯 = 低活動区間
      </p>
    </div>
  );
}

export function HighlightsTab({ videoId }: HighlightsTabProps) {
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
    return data.density.buckets.map((bucket) => ({
      bucket_start_sec: bucket.bucket_start_sec,
      count: bucket.count,
      timeLabel: formatSeconds(bucket.bucket_start_sec),
    }));
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
          <CardTitle>コメント密度</CardTitle>
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
            averageCount={data.density.average_count}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>盛り上がり候補</CardTitle>
        </CardHeader>
        <CardContent>
          <HighlightsList items={data.highlights.items} />
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
