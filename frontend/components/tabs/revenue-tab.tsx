"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, Info, Wallet } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { JumpLinkButton } from "@/components/jump-link-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  downloadTextFile,
  getRevenueTabDataWithFallback,
  getSuperChats,
  getThankYouExportWithFallback,
  type ExportType,
  type RevenueTabData,
  type SuperChatItem,
} from "@/lib/api/revenue";
import { exportFilename } from "@/lib/export-filename";
import { getMockSuperChats } from "@/lib/mocks/revenue";
import { formatSeconds } from "@/lib/format";

type RevenueTabProps = {
  videoId: string;
};

const PAGE_SIZE = 50;

function totalSuperChatCount(data: RevenueTabData): number {
  return data.summary.by_currency.reduce((sum, row) => sum + row.count, 0);
}

function buildChartData(data: RevenueTabData) {
  const timelineMap = new Map(
    data.summary.timeline.map((bucket) => [bucket.bucket_start_sec, bucket]),
  );

  return data.density.buckets.map((bucket) => {
    const sc = timelineMap.get(bucket.bucket_start_sec);
    return {
      label: formatSeconds(bucket.bucket_start_sec),
      density: bucket.count,
      superChatCount: sc?.count ?? 0,
      superChatAmount: sc?.amount_jpy ?? 0,
    };
  });
}

function CurrencySummary({ data }: { data: RevenueTabData }) {
  const rows = data.summary.by_currency;

  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-label="通貨別サマリー">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <KpiCard
            key={row.currency}
            title={`合計（${row.currency}）`}
            value={`${row.total_amount.toLocaleString()} ${row.currency}`}
            description={`${row.count.toLocaleString()} 件`}
          />
        ))}
      </div>
    </section>
  );
}

function DensitySuperChatChart({ data }: { data: RevenueTabData }) {
  const chartData = useMemo(() => buildChartData(data), [data]);

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">グラフデータがありません。</p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            yAxisId="density"
            tick={{ fontSize: 11 }}
            width={40}
            label={{
              value: "密度",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11 },
            }}
          />
          <YAxis
            yAxisId="amount"
            orientation="right"
            tick={{ fontSize: 11 }}
            width={48}
            label={{
              value: "スパチャ (JPY)",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value, name) => {
              if (name === "density") return [`${value} 件/分`, "コメント密度"];
              if (name === "superChatAmount") {
                return [`${Number(value).toLocaleString()} JPY`, "スパチャ金額"];
              }
              return [value, name];
            }}
          />
          <Legend />
          <Bar
            yAxisId="density"
            dataKey="density"
            name="コメント密度"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            opacity={0.85}
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="superChatAmount"
            name="スパチャ金額"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f59e0b" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function SuperChatsTable({
  items,
  page,
  total,
  loading,
  onPageChange,
}: {
  items: SuperChatItem[];
  page: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">時刻</th>
              <th className="px-3 py-2 font-medium">投稿者</th>
              <th className="px-3 py-2 font-medium tabular-nums">金額</th>
              <th className="px-3 py-2 font-medium">メッセージ</th>
              <th className="px-3 py-2 font-medium">ジャンプ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  読み込み中…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  スパチャはありませんでした
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={`${item.time_in_seconds}-${item.author_name}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {item.time_text}
                  </td>
                  <td className="px-3 py-2">{item.author_name}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {item.amount.toLocaleString()} {item.currency}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2" title={item.message}>
                    {item.message || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <JumpLinkButton
                      jumpUrl={item.jump_url}
                      timeText={item.time_text}
                      size="xs"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {total.toLocaleString()} 件中 {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} 件
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              前へ
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              次へ
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportActions({
  videoId,
  allItems,
  disabled,
}: {
  videoId: string;
  allItems: SuperChatItem[];
  disabled: boolean;
}) {
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runExport = useCallback(
    async (type: ExportType, mode: "copy" | "download") => {
      setExporting(type);
      setFeedback(null);
      try {
        const { content } = await getThankYouExportWithFallback(
          videoId,
          type,
          allItems,
        );
        if (mode === "copy") {
          await navigator.clipboard.writeText(content);
          setFeedback(
            type === "csv"
              ? "CSV をクリップボードにコピーしました"
              : "Markdown をクリップボードにコピーしました",
          );
        } else {
          downloadTextFile(
            content,
            exportFilename(videoId, type),
            type === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8",
          );
          setFeedback(
            type === "csv" ? "CSV をダウンロードしました" : "Markdown をダウンロードしました",
          );
        }
      } catch {
        setFeedback("エクスポートに失敗しました");
      } finally {
        setExporting(null);
      }
    },
    [videoId, allItems],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting !== null}
          onClick={() => runExport("csv", "copy")}
        >
          <Copy data-icon="inline-start" />
          CSV コピー
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting !== null}
          onClick={() => runExport("csv", "download")}
        >
          <Download data-icon="inline-start" />
          CSV ダウンロード
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting !== null}
          onClick={() => runExport("markdown-thanks", "copy")}
        >
          <Copy data-icon="inline-start" />
          Markdown コピー
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting !== null}
          onClick={() => runExport("markdown-thanks", "download")}
        >
          <Download data-icon="inline-start" />
          Markdown ダウンロード
        </Button>
      </div>
      {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <Wallet className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-lg font-medium">スパチャはありませんでした</p>
      <p className="max-w-md text-sm text-muted-foreground">
        この配信では Super Chat / Super Thanks のデータが検出されませんでした。
      </p>
    </div>
  );
}

export function RevenueTab({ videoId }: RevenueTabProps) {
  const [data, setData] = useState<RevenueTabData | null>(null);
  const [listItems, setListItems] = useState<SuperChatItem[]>([]);
  const [page, setPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setPage(1);
      try {
        const { data: tabData, isMock: mock } =
          await getRevenueTabDataWithFallback(videoId);
        if (!cancelled) {
          setData(tabData);
          setListItems(tabData.superChats.items);
          setListTotal(tabData.superChats.pagination.total);
          setIsMock(mock);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const loadPage = useCallback(
    async (nextPage: number) => {
      setListLoading(true);
      try {
        if (isMock) {
          const mock = getMockSuperChats(videoId, nextPage, PAGE_SIZE);
          setListItems(mock.items);
          setListTotal(mock.pagination.total);
          setPage(nextPage);
          return;
        }
        const res = await getSuperChats(videoId, nextPage, PAGE_SIZE);
        setListItems(res.items);
        setListTotal(res.pagination.total);
        setPage(nextPage);
      } catch {
        const mock = getMockSuperChats(videoId, nextPage, PAGE_SIZE);
        setListItems(mock.items);
        setListTotal(mock.pagination.total);
        setPage(nextPage);
      } finally {
        setListLoading(false);
      }
    },
    [videoId, isMock],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>収益データを読み込めませんでした</AlertTitle>
        <AlertDescription>しばらくしてから再度お試しください。</AlertDescription>
      </Alert>
    );
  }

  const hasSuperChats = totalSuperChatCount(data) > 0;

  if (!hasSuperChats) {
    return (
      <div className="space-y-6">
        {isMock ? (
          <Alert>
            <Info />
            <AlertTitle>サンプルデータを表示中</AlertTitle>
            <AlertDescription>
              API 未接続のため、見本データで画面を表示しています。
            </AlertDescription>
          </Alert>
        ) : null}
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isMock ? (
        <Alert>
          <Info />
          <AlertTitle>サンプルデータを表示中</AlertTitle>
          <AlertDescription>
            API 未接続のため、見本データで画面を表示しています。
          </AlertDescription>
        </Alert>
      ) : null}

      <CurrencySummary data={data} />

      <Card>
        <CardHeader>
          <CardTitle>密度 × スパチャ</CardTitle>
        </CardHeader>
        <CardContent>
          <DensitySuperChatChart data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スパチャ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <SuperChatsTable
            items={listItems}
            page={page}
            total={listTotal}
            loading={listLoading}
            onPageChange={loadPage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>お礼リスト エクスポート</CardTitle>
        </CardHeader>
        <CardContent>
          <ExportActions videoId={videoId} allItems={listItems} disabled={false} />
        </CardContent>
      </Card>
    </div>
  );
}
