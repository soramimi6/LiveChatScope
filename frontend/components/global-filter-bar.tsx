"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  getVideoStatus,
  postAnalysisRefilter,
  type DisplayFilter,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type GlobalFilterBarProps = {
  videoId: string;
  initialFilter: DisplayFilter;
  analysisStatus: string;
  onRefilterComplete: (filter: DisplayFilter) => void;
  onRefilterStart?: () => void;
  className?: string;
};

function isFilterActive(filter: DisplayFilter): boolean {
  if (filter.exclude_stamp_only) return true;
  if (filter.exclude_ng_keywords && filter.ng_keywords.length > 0) return true;
  if (filter.excluded_author_ids.length > 0) return true;
  return false;
}

function filterTooltip(filter: DisplayFilter): string {
  const parts: string[] = [];
  if (filter.exclude_stamp_only) {
    parts.push("スタンプのみ発言を除外");
  }
  if (filter.exclude_ng_keywords && filter.ng_keywords.length > 0) {
    parts.push(`NGキーワードを除外（${filter.ng_keywords.join("、")}）`);
  }
  if (filter.excluded_author_ids.length > 0) {
    parts.push(`除外ユーザー ${filter.excluded_author_ids.length} 件`);
  }
  return parts.join(" / ");
}

export function GlobalFilterBar({
  videoId,
  initialFilter,
  analysisStatus,
  onRefilterComplete,
  onRefilterStart,
  className,
}: GlobalFilterBarProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [updating, setUpdating] = useState(analysisStatus === "running");
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef(filter);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const onRefilterCompleteRef = useRef(onRefilterComplete);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

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

  const disabled = updating || analysisStatus === "running";
  const ngKeywordsAvailable = filter.ng_keywords.length > 0;
  const filterActive = isFilterActive(filter);

  return (
    <section
      aria-label="表示フィルター"
      className={cn("mb-6 space-y-3 rounded-xl border bg-card p-4", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
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
          </div>
          <p className="text-xs text-muted-foreground">
            話題・キーワード・投稿者ランキングなどに反映されます。密度グラフ・盛り上がり候補は全メッセージのまま表示されます。
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-8">
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
              絵文字・スタンプのみのコメントを話題分析から除外します
            </span>
          </span>
        </label>

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
            {ngKeywordsAvailable ? (
              <span className="block text-xs text-muted-foreground">
                登録済み: {filter.ng_keywords.join("、")}
              </span>
            ) : (
              <span className="block text-xs text-muted-foreground">
                NGキーワードが未設定のため利用できません
              </span>
            )}
          </span>
        </label>
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
    </section>
  );
}
