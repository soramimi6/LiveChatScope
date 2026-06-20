"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { PartialAnalysisBadge } from "@/components/partial-analysis-badge";
import { SiteHeader } from "@/components/site-header";
import { SummaryTab } from "@/components/tabs/summary-tab";
import { getVideo, type VideoMetaResponse } from "@/lib/api";

const TABS = [
  { id: "summary", label: "サマリー" },
  { id: "topics", label: "話題分析" },
  { id: "highlights", label: "盛り上がり" },
  { id: "revenue", label: "収益" },
  { id: "community", label: "コミュニティ" },
  { id: "search", label: "詳細検索" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TabPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <p className="text-sm text-muted-foreground">このタブの実装は後続タスク（W6–W11）で追加します。</p>
      </CardContent>
    </Card>
  );
}

export function VideoDashboard() {
  const params = useParams<{ videoId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = params.videoId;
  const activeTab = (searchParams.get("tab") as TabId) || "summary";
  const [meta, setMeta] = useState<VideoMetaResponse | null>(null);

  useEffect(() => {
    getVideo(videoId).then(setMeta).catch(() => setMeta(null));
  }, [videoId]);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader
        title={meta?.title ?? `動画 ${videoId}`}
        subtitle={meta?.channel_name ?? undefined}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">メッセージ {meta?.message_count?.toLocaleString() ?? "—"}</Badge>
          <Badge variant="outline">取得: {meta?.fetch_status ?? "—"}</Badge>
          {meta?.analysis_status === "partial" ? (
            <PartialAnalysisBadge />
          ) : (
            <Badge variant="outline">分析: {meta?.analysis_status ?? "—"}</Badge>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => router.push(`/videos/${videoId}?tab=${value}`)}
        >
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="summary">
            <SummaryTab videoId={videoId} durationSeconds={meta?.duration_seconds} />
          </TabsContent>
          <TabsContent value="topics">
            <TabPlaceholder title="話題分析" description="話題ブロック・キーワード・遷移（FR-3b–e）" />
          </TabsContent>
          <TabsContent value="highlights">
            <TabPlaceholder title="盛り上がり" description="密度グラフ・候補・低活動区間（FR-3a, FR-3p2–p3）" />
          </TabsContent>
          <TabsContent value="revenue">
            <TabPlaceholder title="収益" description="スパチャ集計・お礼リスト（FR-3p1, FR-3p5）" />
          </TabsContent>
          <TabsContent value="community">
            <TabPlaceholder title="コミュニティ" description="Top 投稿者・常連・話題別 Top（FR-3e, FR-3p4）" />
          </TabsContent>
          <TabsContent value="search">
            <TabPlaceholder title="詳細検索" description="キーワード検索・フィルタ（FR-2）" />
          </TabsContent>
        </Tabs>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
