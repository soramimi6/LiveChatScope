"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, Info, TriangleAlert, Wallet } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer } from "@/components/chart-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DensityYScaleToggle } from "@/components/density-y-scale-toggle";
import { KpiCard } from "@/components/kpi-card";
import { JumpLinkButton } from "@/components/jump-link-button";
import { TopicSuperChatRanking } from "@/components/topic-super-chat-ranking";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet } from "@/components/ui/sheet";
import { getTopicsWithFallback, type TopicsResponse } from "@/lib/api";
import {
  getLowActivityWithFallback,
  type LowActivityItem,
} from "@/lib/api/highlights";
import {
  buildThankYouCsv,
  downloadTextFile,
  getRevenueTabDataWithFallback,
  getSuperChats,
  getThankYouExportWithFallback,
  type ExportType,
  type RevenueTabData,
  type SuperChatItem,
  type SuperChatStatus,
} from "@/lib/api/revenue";
import { exportFilename } from "@/lib/export-filename";
import { getMockSuperChats } from "@/lib/mocks/revenue";
import { formatSeconds } from "@/lib/format";
import {
  commentsPerMinute,
  formatRatePerMin,
} from "@/lib/density-chart";
import {
  DENSITY_LOG_FLOOR,
  SUPER_CHAT_AMOUNT_LOG_FLOOR,
  densityRateForEmphasisScale,
  densityRateForLogScale,
  densityYScaleLabel,
  formatYAxisTickForScale,
  rechartsYAxisScale,
  superChatAmountForEmphasisScale,
  superChatAmountForLogScale,
  yAxisDomain,
  yScaleSeriesKey,
  type DensityYScale,
} from "@/lib/density-y-scale";
import { useDensityYScale } from "@/lib/use-density-y-scale";

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
  const bucketSec = data.density.bucket_sec;

  return data.density.buckets.map((bucket) => {
    const sc = timelineMap.get(bucket.bucket_start_sec);
    const density = commentsPerMinute(bucket.count, bucketSec);
    const superChatAmount = sc?.amount_jpy ?? 0;
    return {
      bucket_start_sec: bucket.bucket_start_sec,
      label: formatSeconds(bucket.bucket_start_sec),
      density,
      logDensity: densityRateForLogScale(density),
      emphDensity: densityRateForEmphasisScale(density),
      superChatCount: sc?.count ?? 0,
      superChatAmount,
      logSuperChatAmount: superChatAmountForLogScale(superChatAmount),
      emphSuperChatAmount: superChatAmountForEmphasisScale(superChatAmount),
    };
  });
}

function CurrencySummary({
  data,
  onCurrencyClick,
}: {
  data: RevenueTabData;
  onCurrencyClick: (currency: string) => void;
}) {
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
            onClick={() => onCurrencyClick(row.currency)}
          />
        ))}
      </div>
    </section>
  );
}

function SuperChatCurrencySheet({
  videoId,
  currency,
  open,
  onOpenChange,
  isMock,
}: {
  videoId: string;
  currency: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMock: boolean;
}) {
  const [items, setItems] = useState<SuperChatItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (!currency) return;
      setLoading(true);
      try {
        if (isMock) {
          const mock = getMockSuperChats(videoId, nextPage, PAGE_SIZE, currency);
          setItems(mock.items);
          setTotal(mock.pagination.total);
          setPage(nextPage);
          return;
        }
        const res = await getSuperChats(videoId, nextPage, PAGE_SIZE, currency);
        setItems(res.items);
        setTotal(res.pagination.total);
        setPage(nextPage);
      } catch {
        const mock = getMockSuperChats(videoId, nextPage, PAGE_SIZE, currency);
        setItems(mock.items);
        setTotal(mock.pagination.total);
        setPage(nextPage);
      } finally {
        setLoading(false);
      }
    },
    [videoId, currency, isMock],
  );

  useEffect(() => {
    if (!open || !currency) {
      setItems([]);
      setPage(1);
      setTotal(0);
      return;
    }
    void loadPage(1);
  }, [open, currency, loadPage]);

  if (!currency) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${currency} スパチャ明細`}
      description={`${total.toLocaleString()} 件の内訳`}
      className="max-w-2xl"
    >
      <SuperChatsTable
        items={items}
        page={page}
        total={total}
        loading={loading}
        onPageChange={loadPage}
      />
    </Sheet>
  );
}

const SUPER_CHAT_MARKER_COLOR = "#f59e0b";

function superChatChartPoint(payload: unknown): { superChatAmount: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const amount = (payload as { superChatAmount?: unknown }).superChatAmount;
  return typeof amount === "number" ? { superChatAmount: amount } : null;
}

function SuperChatMarkerDot(props: {
  cx?: number;
  cy?: number;
  payload?: unknown;
}) {
  const { cx, cy, payload } = props;
  const point = superChatChartPoint(payload);
  if (cx == null || cy == null || !point || point.superChatAmount <= 0) {
    return null;
  }
  return <circle cx={cx} cy={cy} r={3} fill={SUPER_CHAT_MARKER_COLOR} />;
}

function DensitySuperChatChart({
  data,
  densityYScale,
  superChatYScale,
  lowActivity,
}: {
  data: RevenueTabData;
  densityYScale: DensityYScale;
  superChatYScale: DensityYScale;
  lowActivity: LowActivityItem[];
}) {
  const chartData = useMemo(() => buildChartData(data), [data]);
  const densityDataKey = yScaleSeriesKey(densityYScale, {
    linear: "density",
    log: "logDensity",
    emphasis: "emphDensity",
  });
  const superChatDataKey = yScaleSeriesKey(superChatYScale, {
    linear: "superChatAmount",
    log: "logSuperChatAmount",
    emphasis: "emphSuperChatAmount",
  });

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">グラフデータがありません。</p>
    );
  }

  return (
    <div>
      <ChartContainer className="h-72 w-full">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="bucket_start_sec"
            tickFormatter={(value) => formatSeconds(Number(value))}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            yAxisId="density"
            scale={rechartsYAxisScale(densityYScale)}
            domain={yAxisDomain(densityYScale, DENSITY_LOG_FLOOR)}
            allowDataOverflow
            tick={{ fontSize: 11 }}
            width={48}
            tickFormatter={(value) =>
              formatYAxisTickForScale(Number(value), densityYScale)
            }
            label={{
              value: "件/分",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11 },
            }}
          />
          <YAxis
            yAxisId="amount"
            orientation="right"
            scale={rechartsYAxisScale(superChatYScale)}
            domain={yAxisDomain(superChatYScale, SUPER_CHAT_AMOUNT_LOG_FLOOR)}
            allowDataOverflow
            tick={{ fontSize: 11 }}
            width={48}
            tickFormatter={(value) =>
              formatYAxisTickForScale(Number(value), superChatYScale)
            }
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
            labelFormatter={(value) => `開始 ${formatSeconds(Number(value))}`}
            formatter={(_value, name, item) => {
              const payload = item.payload as {
                density: number;
                superChatAmount: number;
                superChatCount: number;
              };
              if (name === "コメント密度") {
                return [formatRatePerMin(payload.density), "コメント密度"];
              }
              if (name === "スパチャ金額") {
                return [
                  `${payload.superChatAmount.toLocaleString()} JPY`,
                  "スパチャ金額",
                ];
              }
              if (name === "スパチャ件数") {
                return [`${payload.superChatCount} 件`, "スパチャ件数"];
              }
              return [_value, name];
            }}
          />
          <Legend />
          {lowActivity.map((segment) => (
            <ReferenceArea
              key={`${segment.start_sec}-${segment.end_sec}`}
              x1={segment.start_sec}
              x2={segment.end_sec}
              fill="var(--chart-low-activity)"
              strokeOpacity={0}
            />
          ))}
          <Bar
            yAxisId="density"
            dataKey={densityDataKey}
            name="コメント密度"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            opacity={0.85}
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey={superChatDataKey}
            name="スパチャ金額"
            stroke="none"
            strokeWidth={0}
            dot={SuperChatMarkerDot}
            activeDot={SuperChatMarkerDot}
          />
        </ComposedChart>
      </ChartContainer>
      <p className="mt-2 text-xs text-muted-foreground">
        密度 縦軸 {densityYScaleLabel(densityYScale)} · スパチャ 縦軸{" "}
        {densityYScaleLabel(superChatYScale)} · 赤帯 = 低活動区間
      </p>
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
        const content =
          type === "csv"
            ? buildThankYouCsv(allItems)
            : (
                await getThankYouExportWithFallback(videoId, type, allItems)
              ).content;
        if (mode === "copy") {
          await navigator.clipboard.writeText(content);
          setFeedback(
            type === "csv"
              ? "スパチャ CSV をクリップボードにコピーしました"
              : "Markdown をクリップボードにコピーしました",
          );
        } else {
          downloadTextFile(
            content,
            exportFilename(videoId, type),
            type === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8",
          );
          setFeedback(
            type === "csv"
              ? "スパチャ CSV をダウンロードしました"
              : "Markdown をダウンロードしました",
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
      <p className="text-xs text-muted-foreground">
        スパチャ CSV はこのタブの一覧のみ。全チャットログはヘッダの CSV — チャットログのみから取得できます。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting !== null}
          title="スーパーチャット一覧のみ（全チャットログではありません）"
          onClick={() => runExport("csv", "copy")}
        >
          <Copy data-icon="inline-start" />
          スパチャ CSV コピー
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting !== null}
          title="スーパーチャット一覧のみ（全チャットログではありません）"
          onClick={() => runExport("csv", "download")}
        >
          <Download data-icon="inline-start" />
          スパチャ CSV DL
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

const SUPER_CHAT_EMPTY_DEFAULTS: Record<
  Exclude<SuperChatStatus, "present">,
  { title: string; message: string }
> = {
  none_in_chat: {
    title: "スーパーチャットはありませんでした",
    message:
      "この配信では Super Chat / Super Thanks のデータが検出されませんでした。",
  },
  amount_parse_failed: {
    title: "金額情報を取得できませんでした",
    message:
      "スーパーチャットの金額情報を解析できませんでした。チャットログにスーパーチャットが含まれている場合は、形式の変更などが原因の可能性があります。",
  },
};

function SuperChatEmptyState({
  status,
  message,
}: {
  status: Exclude<SuperChatStatus, "present">;
  message?: string | null;
}) {
  const defaults = SUPER_CHAT_EMPTY_DEFAULTS[status];
  const title = defaults.title;
  const description = message ?? defaults.message;

  if (status === "amount_parse_failed") {
    return (
      <Alert className="border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-100">
        <TriangleAlert className="text-amber-600 dark:text-amber-400" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="text-amber-900/80 dark:text-amber-100/80">
          {description}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <Wallet className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function RevenueTab({ videoId }: RevenueTabProps) {
  const [densityYScale, setDensityYScale] = useDensityYScale("revenue-density");
  const [superChatYScale, setSuperChatYScale] = useDensityYScale("revenue-superchat");
  const [data, setData] = useState<RevenueTabData | null>(null);
  const [topics, setTopics] = useState<TopicsResponse | null>(null);
  const [lowActivity, setLowActivity] = useState<LowActivityItem[]>([]);
  const [listItems, setListItems] = useState<SuperChatItem[]>([]);
  const [page, setPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setPage(1);
      try {
        const [{ data: tabData, isMock: mock }, topicsResult, lowActivityResult] =
          await Promise.all([
            getRevenueTabDataWithFallback(videoId),
            getTopicsWithFallback(videoId),
            getLowActivityWithFallback(videoId),
          ]);
        if (!cancelled) {
          setData(tabData);
          setTopics(topicsResult.data);
          setLowActivity(lowActivityResult.data.items);
          setListItems(tabData.superChats.items);
          setListTotal(tabData.superChats.pagination.total);
          setIsMock(mock || topicsResult.isMock || lowActivityResult.isMock);
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

  const superChatStatus = data.summary.super_chat_status ?? "present";
  const superChatCount = totalSuperChatCount(data);
  const showEmptyState =
    superChatStatus !== "present" || superChatCount === 0;
  const emptyStatus: Exclude<SuperChatStatus, "present"> =
    superChatStatus !== "present" ? superChatStatus : "none_in_chat";

  if (showEmptyState) {
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
        <SuperChatEmptyState
          status={emptyStatus}
          message={data.summary.super_chat_status_message}
        />
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

      <CurrencySummary data={data} onCurrencyClick={setSelectedCurrency} />

      <SuperChatCurrencySheet
        videoId={videoId}
        currency={selectedCurrency}
        open={selectedCurrency != null}
        onOpenChange={(open) => {
          if (!open) setSelectedCurrency(null);
        }}
        isMock={isMock}
      />

      {topics ? (
        <TopicSuperChatRanking
          blocks={topics.items}
          interactiveLabels={!isMock}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>密度 × スパチャ</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">密度</span>
              <DensityYScaleToggle
                value={densityYScale}
                onChange={setDensityYScale}
                ariaLabel="密度の縦軸スケール"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">スパチャ</span>
              <DensityYScaleToggle
                value={superChatYScale}
                onChange={setSuperChatYScale}
                ariaLabel="スパチャ金額の縦軸スケール"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DensitySuperChatChart
            data={data}
            densityYScale={densityYScale}
            superChatYScale={superChatYScale}
            lowActivity={lowActivity}
          />
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
