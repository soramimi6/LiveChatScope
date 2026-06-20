"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { SiteHeader } from "@/components/site-header";
import { getVideoStatus, type VideoStatusResponse } from "@/lib/api";

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

        if (data.fetch_status === "fetched") {
          router.replace(`/videos/${videoId}?tab=summary`);
          return;
        }

        if (data.fetch_status === "failed") {
          setError("取得に失敗しました");
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

  const progressValue = (() => {
    if (!status) return 5;
    if (status.fetch_status === "fetched") return 80;
    if (status.fetch_status === "fetching") return 40;
    if (status.fetch_status === "pending") return 10;
    return 0;
  })();

  const stepLabel = (() => {
    if (!status) return "接続中…";
    if (status.fetch_status === "pending") return "ジョブを登録しました";
    if (status.fetch_status === "fetching") return "チャット取得中…";
    if (status.fetch_status === "fetched" && status.analysis_status !== "complete") {
      return "分析処理中…（Pipeline は後続タスクで拡張）";
    }
    return "処理中…";
  })();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader title={`動画 ID: ${videoId}`} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>分析進捗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{stepLabel}</p>
            <Progress value={progressValue} />
            {status ? (
              <p className="text-sm">
                取得済みメッセージ:{" "}
                <span className="font-medium">{status.progress.messages_fetched.toLocaleString()}</span>
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
