"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { SiteHeader } from "@/components/site-header";
import { ApiError, createVideo } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await createVideo(url.trim());
      router.push(`/analyze/${res.video_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("分析の開始に失敗しました。API サーバーが起動しているか確認してください。");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>YouTube URL を分析</CardTitle>
            <CardDescription>
              ライブチャットリプレイが有効な、配信終了後の動画 URL を入力してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading || !url.trim()}>
                {loading ? "開始中…" : "分析を開始"}
              </Button>
            </form>
            <ul className="mt-6 space-y-1 text-xs text-muted-foreground">
              <li>・ライブチャット（コメント欄ではありません）</li>
              <li>・チャットリプレイが無効な配信は取得できません</li>
            </ul>
          </CardContent>
        </Card>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
