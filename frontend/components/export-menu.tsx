"use client";

import { useCallback, useState } from "react";
import { ClipboardCopy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  copyExportToClipboard,
  downloadExport,
  ExportError,
  type ExportType,
} from "@/lib/api/export";
import { cn } from "@/lib/utils";

type ExportMenuProps = {
  videoId: string;
  className?: string;
  analysisStatus?: string;
};

type ExportAction = "download" | "copy";

type ExportOption = {
  type: ExportType;
  label: string;
  description?: string;
  group: "data" | "markdown";
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    type: "json",
    label: "JSON — 分析結果一式",
    description: "密度・話題・キーワード・全メッセージ等を含む",
    group: "data",
  },
  {
    type: "csv",
    label: "CSV — チャットログのみ",
    description: "表計算用。密度・話題などの集約データは含まれません",
    group: "data",
  },
  {
    type: "markdown-summary",
    label: "振り返りサマリー",
    group: "markdown",
  },
  {
    type: "markdown-clips",
    label: "切り抜き候補",
    group: "markdown",
  },
  {
    type: "markdown-thanks",
    label: "お礼リスト",
    group: "markdown",
  },
];

function actionLabel(option: ExportOption, action: ExportAction): string {
  const verb = action === "download" ? "DL" : "コピー";
  return `${option.label}を${verb}`;
}

export function ExportMenu({
  videoId,
  className,
  analysisStatus,
}: ExportMenuProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const disabledByAnalysis = analysisStatus === "running";

  const handleAction = useCallback(
    async (type: ExportType, action: ExportAction) => {
      const key = `${type}:${action}`;
      setBusyKey(key);
      setFeedback(null);

      try {
        if (action === "download") {
          await downloadExport(videoId, type);
          setFeedback({ kind: "success", message: "ダウンロードを開始しました" });
        } else {
          await copyExportToClipboard(videoId, type);
          setFeedback({ kind: "success", message: "クリップボードにコピーしました" });
        }
      } catch (err) {
        const message =
          err instanceof ExportError
            ? err.message
            : "エクスポートに失敗しました";
        setFeedback({ kind: "error", message });
      } finally {
        setBusyKey(null);
      }
    },
    [videoId],
  );

  const dataOptions = EXPORT_OPTIONS.filter((o) => o.group === "data");
  const markdownOptions = EXPORT_OPTIONS.filter((o) => o.group === "markdown");

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label="分析結果をエクスポート"
              disabled={busyKey !== null || disabledByAnalysis}
            />
          }
        >
          {busyKey ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          エクスポート
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>データ</DropdownMenuLabel>
            <p className="px-1.5 pb-1 text-[11px] leading-snug text-muted-foreground">
              一式が必要なら JSON、チャットログだけなら CSV を選んでください
            </p>
            {dataOptions.flatMap((option) => [
              <DropdownMenuItem
                key={`${option.type}:download`}
                disabled={busyKey !== null}
                title={option.description}
                onClick={() => handleAction(option.type, "download")}
              >
                <Download />
                {actionLabel(option, "download")}
              </DropdownMenuItem>,
              <DropdownMenuItem
                key={`${option.type}:copy`}
                disabled={busyKey !== null}
                title={option.description}
                onClick={() => handleAction(option.type, "copy")}
              >
                <ClipboardCopy />
                {actionLabel(option, "copy")}
              </DropdownMenuItem>,
            ])}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Markdown</DropdownMenuLabel>
            {markdownOptions.flatMap((option) => [
              <DropdownMenuItem
                key={`${option.type}:download`}
                disabled={busyKey !== null}
                onClick={() => handleAction(option.type, "download")}
              >
                <Download />
                {actionLabel(option, "download")}
              </DropdownMenuItem>,
              <DropdownMenuItem
                key={`${option.type}:copy`}
                disabled={busyKey !== null}
                onClick={() => handleAction(option.type, "copy")}
              >
                <ClipboardCopy />
                {actionLabel(option, "copy")}
              </DropdownMenuItem>,
            ])}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {disabledByAnalysis ? (
        <p className="text-xs text-muted-foreground">
          フィルター更新中はエクスポートできません
        </p>
      ) : null}
      {feedback ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "text-xs",
            feedback.kind === "success"
              ? "text-muted-foreground"
              : "text-destructive",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
