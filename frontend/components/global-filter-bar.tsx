"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Filter, Loader2, Plus, X } from "lucide-react";
import { RefilterPendingBadge } from "@/components/refilter-pending-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getVideoStatus,
  postAnalysisRefilter,
  type DisplayFilter,
} from "@/lib/api";
import {
  normalizeAuthorId,
  normalizeKeyword,
} from "@/lib/session-filter";
import { cn } from "@/lib/utils";
import type { DisplayFilterActions } from "@/components/display-filter-actions-context";

type GlobalFilterBarProps = {
  videoId: string;
  initialFilter: DisplayFilter;
  analysisStatus: string;
  onRefilterComplete: (filter: DisplayFilter) => void;
  onRefilterStart?: () => void;
  onActionsReady?: (actions: DisplayFilterActions) => void;
  className?: string;
};

function isFilterActive(filter: DisplayFilter): boolean {
  if (filter.exclude_stamp_only) return true;
  if (filter.exclude_ng_keywords && filter.ng_keywords.length > 0) return true;
  if ((filter.auto_ng_keywords?.length ?? 0) > 0) return true;
  if (filter.excluded_author_ids.length > 0) return true;
  return false;
}

function filterTooltip(filter: DisplayFilter): string {
  const parts: string[] = [];
  if (filter.exclude_stamp_only) {
    parts.push("スタンプのみ発言を除外");
  }
  if ((filter.auto_ng_keywords?.length ?? 0) > 0) {
    parts.push(
      `自動 NG キーワード（${filter.auto_ng_keywords.join("、")}）`,
    );
  }
  if (filter.exclude_ng_keywords && filter.ng_keywords.length > 0) {
    parts.push(`NGキーワードを除外（${filter.ng_keywords.join("、")}）`);
  }
  if (filter.excluded_author_ids.length > 0) {
    parts.push(`除外ユーザー ${filter.excluded_author_ids.join("、")}`);
  }
  return parts.join(" / ");
}

export function GlobalFilterBar({
  videoId,
  initialFilter,
  analysisStatus,
  onRefilterComplete,
  onRefilterStart,
  onActionsReady,
  className,
}: GlobalFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState(() => initialFilter);
  const [updating, setUpdating] = useState(analysisStatus === "running");
  const [error, setError] = useState<string | null>(null);
  const [ngInput, setNgInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const filterRef = useRef(filter);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onRefilterCompleteRef = useRef(onRefilterComplete);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter, videoId]);

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    onRefilterCompleteRef.current = onRefilterComplete;
  }, [onRefilterComplete]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finishRefilter = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopPolling();
    setUpdating(false);
    setError(null);
    onRefilterCompleteRef.current(filterRef.current);
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    completedRef.current = false;

    pollRef.current = setInterval(async () => {
      try {
        const status = await getVideoStatus(videoId);
        if (status.analysis_status === "complete") {
          finishRefilter();
        } else if (status.analysis_status === "failed") {
          stopPolling();
          setUpdating(false);
          setError("フィルター更新に失敗しました");
        }
      } catch {
        // Keep polling until the next attempt succeeds.
      }
    }, 2000);
  }, [videoId, finishRefilter, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (analysisStatus === "running") {
      setUpdating(true);
      startPolling();
      return;
    }

    if (
      updating &&
      (analysisStatus === "complete" ||
        analysisStatus === "partial" ||
        analysisStatus === "failed")
    ) {
      if (analysisStatus === "failed") {
        stopPolling();
        setUpdating(false);
        setError("フィルター更新に失敗しました");
        return;
      }
      finishRefilter();
    }
  }, [analysisStatus, updating, startPolling, stopPolling, finishRefilter]);

  const applyFilterChange = useCallback(
    async (nextFilter: DisplayFilter) => {
      const previousFilter = filterRef.current;
      setFilter(nextFilter);
      setUpdating(true);
      setError(null);
      completedRef.current = false;
      onRefilterStart?.();

      try {
        await postAnalysisRefilter(videoId, nextFilter);
        startPolling();
      } catch {
        setFilter(previousFilter);
        setUpdating(false);
        setError("フィルター更新の開始に失敗しました");
      }
    },
    [videoId, onRefilterStart, startPolling],
  );

  const addNgKeywordFromValue = useCallback(
    (raw: string) => {
      const keyword = normalizeKeyword(raw);
      if (!keyword) return;
      if (
        filterRef.current.ng_keywords.some(
          (k) => k.toLowerCase() === keyword.toLowerCase(),
        )
      ) {
        return;
      }
      void applyFilterChange({
        ...filterRef.current,
        ng_keywords: [...filterRef.current.ng_keywords, keyword],
        exclude_ng_keywords: true,
      });
    },
    [applyFilterChange],
  );

  const addNgKeyword = useCallback(() => {
    addNgKeywordFromValue(ngInput);
    setNgInput("");
  }, [ngInput, addNgKeywordFromValue]);

  useEffect(() => {
    onActionsReady?.({
      addNgKeyword: addNgKeywordFromValue,
      ngKeywords: filter.ng_keywords,
      updating,
    });
  }, [
    filter.ng_keywords,
    updating,
    onActionsReady,
    addNgKeywordFromValue,
  ]);

  const removeNgKeyword = useCallback(
    (keyword: string) => {
      const ng_keywords = filterRef.current.ng_keywords.filter((k) => k !== keyword);
      void applyFilterChange({
        ...filterRef.current,
        ng_keywords,
        exclude_ng_keywords: ng_keywords.length > 0 && filterRef.current.exclude_ng_keywords,
      });
    },
    [applyFilterChange],
  );

  const removeAutoNgKeyword = useCallback(
    (keyword: string) => {
      const normalized = normalizeKeyword(keyword);
      if (!normalized) return;

      const dismissed = filterRef.current.dismissed_auto_ng_keywords ?? [];
      const nextDismissed =
        dismissed.some((k) => k.toLowerCase() === normalized.toLowerCase())
          ? dismissed
          : [...dismissed, normalized];
      const auto_ng_keywords = filterRef.current.auto_ng_keywords.filter(
        (k) => k.toLowerCase() !== normalized.toLowerCase(),
      );

      void applyFilterChange({
        ...filterRef.current,
        auto_ng_keywords,
        dismissed_auto_ng_keywords: nextDismissed,
        exclude_ng_keywords:
          (filterRef.current.exclude_ng_keywords &&
            filterRef.current.ng_keywords.length > 0) ||
          auto_ng_keywords.length > 0,
      });
    },
    [applyFilterChange],
  );

  const addExcludedAuthor = useCallback(() => {
    const authorId = normalizeAuthorId(authorInput);
    if (!authorId) return;
    if (filterRef.current.excluded_author_ids.includes(authorId)) {
      setAuthorInput("");
      return;
    }
    setAuthorInput("");
    void applyFilterChange({
      ...filterRef.current,
      excluded_author_ids: [...filterRef.current.excluded_author_ids, authorId],
    });
  }, [authorInput, applyFilterChange]);

  const removeExcludedAuthor = useCallback(
    (authorId: string) => {
      void applyFilterChange({
        ...filterRef.current,
        excluded_author_ids: filterRef.current.excluded_author_ids.filter(
          (id) => id !== authorId,
        ),
      });
    },
    [applyFilterChange],
  );

  const disabled = updating || analysisStatus === "running";
  const autoNgKeywords = filter.auto_ng_keywords ?? [];
  const ngKeywordsAvailable =
    filter.ng_keywords.length > 0 || autoNgKeywords.length > 0;
  const filterActive = isFilterActive(filter);

  return (
    <section
      aria-label="表示フィルター"
      className={cn(
        "mb-6 rounded-xl border bg-card",
        expanded ? "space-y-4 p-4" : "p-3",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">表示フィルター</h2>
            {filterActive ? (
              <Badge
                variant="secondary"
                title={filterTooltip(filter)}
                className="cursor-help"
              >
                <Filter data-icon="inline-start" />
                フィルター適用中
              </Badge>
            ) : null}
            {updating ? <RefilterPendingBadge /> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {expanded
              ? "話題・キーワード・エクスポートに反映されます。密度グラフ・盛り上がり候補は全メッセージのまま表示されます。"
              : filterActive
                ? filterTooltip(filter)
                : "クリックして NG キーワード・除外ユーザーなどを設定"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-8">
        <label
          className={cn(
            "flex items-start gap-3",
            ngKeywordsAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-70",
          )}
        >
          <Switch
            checked={filter.exclude_ng_keywords}
            disabled={disabled || !ngKeywordsAvailable}
            aria-label="NGキーワードを除外"
            onCheckedChange={(checked) => {
              void applyFilterChange({
                ...filterRef.current,
                exclude_ng_keywords: checked,
              });
            }}
          />
          <span className="space-y-0.5">
            <span className="text-sm font-medium">NGキーワードを除外</span>
            <span className="block text-xs text-muted-foreground">
              {ngKeywordsAvailable
                ? autoNgKeywords.length > 0 && filter.ng_keywords.length === 0
                  ? "自動検出された語句はキーワード集計から除外されます"
                  : "下で登録した語句を含むコメントを除外します"
                : "先に NG キーワードを追加してください"}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <Switch
            checked={filter.exclude_stamp_only}
            disabled={disabled}
            aria-label="スタンプのみ発言を除外"
            onCheckedChange={(checked) => {
              void applyFilterChange({
                ...filterRef.current,
                exclude_stamp_only: checked,
              });
            }}
          />
          <span className="space-y-0.5">
            <span className="text-sm font-medium">スタンプのみ発言を除外</span>
            <span className="block text-xs text-muted-foreground">
              絵文字・スタンプのみのコメントと `:name:` 形式のスタンプコードを話題分析から除外します
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          NG キーワード・除外ユーザー・スタンプ除外の設定はサーバーに保存され、新規分析開始時の既定値として使われます。自動
          NG の解除は動画ごとに保存され、再分析時も反映されます。
        </p>

        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium">NG キーワード</h3>
          {autoNgKeywords.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                分析時に自動検出された全域語（キーワード集計から除外）。誤検知の場合は削除して解析対象に戻せます。
              </p>
              <div className="flex flex-wrap gap-2">
                {autoNgKeywords.map((keyword) => (
                  <Badge key={keyword} variant="outline" className="gap-1 pr-1">
                    {keyword}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      自動追加
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded-sm p-0.5 hover:bg-muted"
                      aria-label={`${keyword} を自動 NG から解除`}
                      onClick={() => removeAutoNgKeyword(keyword)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Input
              value={ngInput}
              disabled={disabled}
              placeholder="例: 草"
              className="min-w-0 flex-1 sm:max-w-xs"
              aria-label="NG キーワード"
              onChange={(event) => setNgInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addNgKeyword();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || !ngInput.trim()}
              onClick={addNgKeyword}
            >
              <Plus data-icon="inline-start" />
              追加
            </Button>
          </div>
          {filter.ng_keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {filter.ng_keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
                  {keyword}
                  <button
                    type="button"
                    disabled={disabled}
                    className="rounded-sm p-0.5 hover:bg-muted"
                    aria-label={`${keyword} を削除`}
                    onClick={() => removeNgKeyword(keyword)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">未登録</p>
          )}
          </div>

          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-medium">除外ユーザー ID</h3>
            <p className="text-xs text-muted-foreground">
              コミュニティタブの author_id を指定すると、そのユーザーの発言を話題分析から除外します。
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={authorInput}
                disabled={disabled}
                placeholder="例: UCxxxx..."
                className="min-w-0 flex-1 font-mono text-xs sm:max-w-xs"
                aria-label="除外ユーザー ID"
                onChange={(event) => setAuthorInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addExcludedAuthor();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !authorInput.trim()}
                onClick={addExcludedAuthor}
              >
                <Plus data-icon="inline-start" />
                追加
              </Button>
            </div>
            {filter.excluded_author_ids.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filter.excluded_author_ids.map((authorId) => (
                  <Badge key={authorId} variant="outline" className="gap-1 pr-1 font-mono text-xs">
                    {authorId}
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded-sm p-0.5 hover:bg-muted"
                      aria-label={`${authorId} を削除`}
                      onClick={() => removeExcludedAuthor(authorId)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">未登録</p>
            )}
          </div>
        </div>
      </div>

      {updating ? (
        <Alert>
          <Loader2 className="animate-spin" />
          <AlertDescription>
            フィルター条件を反映中です。話題・キーワードなどを再計算しています…
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
        </>
      ) : null}

      {!expanded && error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
