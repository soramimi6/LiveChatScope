"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { JumpLinkButton } from "@/components/jump-link-button";
import {
  searchMessagesWithFallback,
  type MessageItem,
  type MessagesPagination,
} from "@/lib/api/search";

const PAGE_SIZE = 50;

const MESSAGE_TYPE_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "text_message", label: "通常コメント" },
  { value: "super_chat", label: "スーパーチャット" },
  { value: "super_sticker", label: "スーパーステッカー" },
  { value: "system", label: "システム" },
] as const;

const MESSAGE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  MESSAGE_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

type SearchTabProps = {
  videoId: string;
};

type AppliedFilters = {
  q: string;
  author: string;
  message_type: string;
};

function truncateText(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function MessageTypeBadge({ messageType }: { messageType: string }) {
  const label = MESSAGE_TYPE_LABELS[messageType] ?? messageType;
  const variant =
    messageType === "super_chat" || messageType === "super_sticker"
      ? "secondary"
      : "outline";

  return (
    <Badge variant={variant} className="shrink-0 text-[10px]">
      {label}
    </Badge>
  );
}

function ResultsTable({ items }: { items: MessageItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        条件に一致するメッセージがありません。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">時刻</th>
            <th className="px-3 py-2 font-medium">投稿者</th>
            <th className="px-3 py-2 font-medium">種別</th>
            <th className="px-3 py-2 font-medium">本文</th>
            <th className="px-3 py-2 font-medium">ジャンプ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.message_id} className="border-b last:border-b-0">
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {item.time_text}
              </td>
              <td className="px-3 py-2 max-w-[10rem] truncate" title={item.author_name}>
                {item.author_name}
              </td>
              <td className="px-3 py-2">
                <MessageTypeBadge messageType={item.message_type} />
              </td>
              <td className="px-3 py-2 max-w-md truncate" title={item.text}>
                {truncateText(item.text)}
              </td>
              <td className="px-3 py-2">
                <JumpLinkButton
                  jumpUrl={item.jump_url}
                  timeText={item.time_text}
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

function PaginationBar({
  pagination,
  onPageChange,
}: {
  pagination: MessagesPagination;
  onPageChange: (page: number) => void;
}) {
  const { page, page_size, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / page_size));
  const rangeStart = total === 0 ? 0 : (page - 1) * page_size + 1;
  const rangeEnd = Math.min(page * page_size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-sm text-muted-foreground tabular-nums">
        {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} / 全{" "}
        {total.toLocaleString()} 件（{page_size} 件/ページ）
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft data-icon="inline-start" />
          前へ
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          次へ
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}

export function SearchTab({ videoId }: SearchTabProps) {
  const [draftQ, setDraftQ] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");
  const [draftMessageType, setDraftMessageType] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    q: "",
    author: "",
    message_type: "",
  });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MessageItem[]>([]);
  const [pagination, setPagination] = useState<MessagesPagination>({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
  });
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, isMock: mock } = await searchMessagesWithFallback(videoId, {
        q: appliedFilters.q || undefined,
        author: appliedFilters.author || undefined,
        message_type: appliedFilters.message_type || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setItems(data.items);
      setPagination(data.pagination);
      setIsMock(mock);
    } catch {
      setError("メッセージを読み込めませんでした。");
      setItems([]);
      setPagination({ page: 1, page_size: PAGE_SIZE, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [videoId, appliedFilters, page]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilters({
      q: draftQ.trim(),
      author: draftAuthor.trim(),
      message_type: draftMessageType,
    });
    setPage(1);
  };

  const handleReset = () => {
    setDraftQ("");
    setDraftAuthor("");
    setDraftMessageType("");
    setAppliedFilters({ q: "", author: "", message_type: "" });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {isMock && !loading ? (
        <Alert>
          <Info />
          <AlertTitle>サンプルデータを表示中</AlertTitle>
          <AlertDescription>
            API 未接続のため、見本データで画面を表示しています。
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>詳細検索</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSearch}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                キーワード
              </span>
              <Input
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="部分一致で検索"
                autoComplete="off"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                投稿者
              </span>
              <Input
                value={draftAuthor}
                onChange={(e) => setDraftAuthor(e.target.value)}
                placeholder="投稿者名（完全一致）"
                autoComplete="off"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                メッセージ種別
              </span>
              <select
                value={draftMessageType}
                onChange={(e) => setDraftMessageType(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {MESSAGE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1 sm:flex-none">
                <Search data-icon="inline-start" />
                検索
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                クリア
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>検索結果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>読み込みエラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ) : (
            <>
              <ResultsTable items={items} />
              <PaginationBar
                pagination={pagination}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
