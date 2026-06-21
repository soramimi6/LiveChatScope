"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { SiteHeader } from "@/components/site-header";
import { getVideoStatus, type VideoStatusResponse } from "@/lib/api";

const ANALYSIS_STAGE_COUNT = 8;

function progressValue(status: VideoStatusResponse | null): number {
  if (!status) return 5;

  if (status.analysis_status === "complete") return 100;

  if (status.fetch_status === "pending") return 10;
  if (status.fetch_status === "fetching") return 35;

  if (status.fetch_status === "fetched") {
    const stage = status.progress.analysis_stage;
    if (stage != null && stage >= 0) {
      return 45 + Math.round((stage / ANALYSIS_STAGE_COUNT) * 50);
    }
    return 50;
  }

  return 0;
}

function stepLabel(status: VideoStatusResponse | null): string {
  if (!status) return "接続中…";
  if (status.fetch_status === "pending") return "1/5 URL を登録しました";
  if (status.fetch_status === "fetching") return "2/5 チャット取得中…";
  if (status.fetch_status === "fetched") {
    if (status.analysis_status === "complete") return "5/5 分析完了";
    const stageLabel = status.progress.analysis_stage_label;
    if (stageLabel) {
      return `3–4/5 分析中: ${stageLabel}`;
    }
    return "3–4/5 分析処理中…";
  }
  return "処理中…";
}

export default function AnalyzePage() {
  const params = useParams<{ videoId: string }>();
  const router = useRouter();
  const videoId = params.videoId;
  const [status, setStatus] = useState<VideoStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await getVideoStatus(videoId);
        if (cancelled) return;
        setStatus(data);

        if (data.error) {
          setError(data.error.message);
          return;
        }

        if (data.analysis_status === "complete") {
          router.replace(`/videos/${videoId}?tab=summary`);
          return;
        }

        if (data.fetch_status === "failed") {
          setError("取得に失敗しました");
          return;
        }

        if (data.analysis_status === "failed") {
          setError("分析に失敗しました");
          return;
        }
      } catch {
        if (!cancelled) {
          setError("ステータスの取得に失敗しました");
        }
      }
    }

    poll();
    const id = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [videoId, router]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader linkedVideoId={videoId} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>分析進捗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{stepLabel(status)}</p>
            <Progress value={progressValue(status)} />
            {status ? (
              <p className="text-sm">
                取得済みチャットコメント:{" "}
                <span className="font-medium">
                  {status.progress.messages_fetched.toLocaleString()}
                </span>
              </p>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
