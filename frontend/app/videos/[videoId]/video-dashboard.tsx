"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { GlobalFilterBar } from "@/components/global-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { ExportMenu } from "@/components/export-menu";
import { PartialAnalysisBadge } from "@/components/partial-analysis-badge";
import { SiteHeader } from "@/components/site-header";
import { CommunityTab } from "@/components/tabs/community-tab";
import { HighlightsTab } from "@/components/tabs/highlights-tab";
import { RevenueTab } from "@/components/tabs/revenue-tab";
import { SearchTab } from "@/components/tabs/search-tab";
import { SummaryTab } from "@/components/tabs/summary-tab";
import { TopicsTab } from "@/components/tabs/topics-tab";
import {
  DEFAULT_DISPLAY_FILTER,
  getVideo,
  type DisplayFilter,
  type VideoMetaResponse,
} from "@/lib/api";
import { formatSeconds } from "@/lib/format";

const TABS = [
  { id: "summary", label: "サマリー" },
  { id: "topics", label: "話題分析" },
  { id: "highlights", label: "盛り上がり" },
  { id: "revenue", label: "収益" },
  { id: "community", label: "コミュニティ" },
  { id: "search", label: "詳細検索" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function resolveDisplayFilter(meta: VideoMetaResponse | null): DisplayFilter {
  return meta?.display_filter ?? DEFAULT_DISPLAY_FILTER;
}

export function VideoDashboard() {
  const params = useParams<{ videoId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = params.videoId;
  const activeTab = (searchParams.get("tab") as TabId) || "summary";
  const [meta, setMeta] = useState<VideoMetaResponse | null>(null);
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>(
    DEFAULT_DISPLAY_FILTER,
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshMeta = useCallback(() => {
    getVideo(videoId)
      .then((data) => {
        setMeta(data);
        setDisplayFilter(resolveDisplayFilter(data));
      })
      .catch(() => setMeta(null));
  }, [videoId]);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    if (meta?.analysis_status !== "running") return;

    const id = setInterval(refreshMeta, 2000);
    return () => clearInterval(id);
  }, [meta?.analysis_status, refreshMeta]);

  const handleRefilterStart = useCallback(() => {
    setMeta((current) =>
      current ? { ...current, analysis_status: "running" } : current,
    );
  }, []);

  const handleRefilterComplete = useCallback(
    (filter: DisplayFilter) => {
      setDisplayFilter(filter);
      setRefreshKey((key) => key + 1);
      refreshMeta();
    },
    [refreshMeta],
  );

  const headerSubtitle = [
    meta?.channel_name,
    meta?.duration_seconds != null ? formatSeconds(meta.duration_seconds) : null,
  ]
    .filter(Boolean)
    .join(" · ") || undefined;

  const analysisStatus = meta?.analysis_status ?? "unknown";
  const isRefilterRunning = analysisStatus === "running";

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader
        title={meta?.title ?? `動画 ${videoId}`}
        subtitle={headerSubtitle}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">メッセージ {meta?.message_count?.toLocaleString() ?? "—"}</Badge>
            <Badge variant="outline">取得: {meta?.fetch_status ?? "—"}</Badge>
            {meta?.analysis_status === "partial" ? (
              <PartialAnalysisBadge />
            ) : (
              <Badge variant="outline">分析: {analysisStatus}</Badge>
            )}
          </div>
          <ExportMenu videoId={videoId} analysisStatus={analysisStatus} />
        </div>

        <GlobalFilterBar
          videoId={videoId}
          initialFilter={displayFilter}
          analysisStatus={analysisStatus}
          onRefilterStart={handleRefilterStart}
          onRefilterComplete={handleRefilterComplete}
        />

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
            <SummaryTab
              videoId={videoId}
              durationSeconds={meta?.duration_seconds}
              refreshKey={refreshKey}
            />
          </TabsContent>
          <TabsContent value="topics">
            <TopicsTab
              videoId={videoId}
              durationSeconds={meta?.duration_seconds}
              refreshKey={refreshKey}
            />
          </TabsContent>
          <TabsContent value="highlights">
            <HighlightsTab
              videoId={videoId}
              durationSeconds={meta?.duration_seconds}
            />
          </TabsContent>
          <TabsContent value="revenue">
            <RevenueTab videoId={videoId} />
          </TabsContent>
          <TabsContent value="community">
            <CommunityTab
              videoId={videoId}
              durationSeconds={meta?.duration_seconds}
              refreshKey={refreshKey}
            />
          </TabsContent>
          <TabsContent value="search">
            <SearchTab videoId={videoId} />
          </TabsContent>
        </Tabs>
      </main>
      <DisclaimerFooter />
    </div>
  );
}
