"use client";

import { useEffect, useState } from "react";
import { Info, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAuthorsByTopicWithFallback,
  getCommunityTabDataWithFallback,
  type AuthorItem,
  type AuthorsByTopicResponse,
  type CommunityTabData,
} from "@/lib/api/community";
import type { TopicBlock } from "@/lib/api";
import { AuthorProfileSheet } from "@/components/author-profile-sheet";
import { formatSeconds } from "@/lib/format";
import { youtubeChannelUrl } from "@/lib/youtube-channel";

type CommunityTabProps = {
  videoId: string;
  refreshKey?: number;
};

const CORE_REGULAR_DESCRIPTION =
  "話題ブロックの半数以上で発言が確認された視聴者です。配信全体を通して継続的に参加している常連層を示します。";

function AuthorsTable({
  items,
  onAuthorClick,
}: {
  items: Array<Pick<AuthorItem, "rank" | "author_name" | "message_count"> & {
    author_id?: string;
  }>;
  onAuthorClick?: (author: AuthorItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">投稿者データがありません。</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[360px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">順位</th>
            <th className="px-3 py-2 font-medium">名前</th>
            <th className="px-3 py-2 font-medium tabular-nums">件数</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.author_id ?? `${item.rank}-${item.author_name}`}
              className="border-b last:border-b-0"
            >
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.rank}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {onAuthorClick && item.author_id ? (
                    <button
                      type="button"
                      className="text-left font-medium underline-offset-4 hover:underline"
                      onClick={() =>
                        onAuthorClick({
                          author_id: item.author_id!,
                          author_name: item.author_name,
                          message_count: item.message_count,
                          rank: item.rank,
                          is_core_regular: false,
                        })
                      }
                    >
                      {item.author_name}
                    </button>
                  ) : (
                    item.author_name
                  )}
                  {item.author_id && youtubeChannelUrl(item.author_id) ? (
                    <a
                      href={youtubeChannelUrl(item.author_id)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`${item.author_name} の YouTube チャンネルを開く`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums">{item.message_count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoreRegularSection({
  authors,
  onAuthorClick,
}: {
  authors: AuthorItem[];
  onAuthorClick?: (author: AuthorItem) => void;
}) {
  const coreAuthors = authors.filter((author) => author.is_core_regular);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{CORE_REGULAR_DESCRIPTION}</p>
      {coreAuthors.length === 0 ? (
        <p className="text-sm text-muted-foreground">常連コア層は検出されませんでした。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {coreAuthors.map((author) => {
            const channelUrl = youtubeChannelUrl(author.author_id);
            const content = (
              <>
                {author.author_name}
                <span className="ml-1 text-muted-foreground">
                  ({author.message_count.toLocaleString()}件)
                </span>
                {channelUrl ? (
                  <a
                    href={channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex text-muted-foreground hover:text-foreground"
                    aria-label={`${author.author_name} の YouTube チャンネルを開く`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </>
            );

            return onAuthorClick ? (
              <button
                key={author.author_id}
                type="button"
                className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-sm text-secondary-foreground hover:bg-secondary/80"
                onClick={() => onAuthorClick(author)}
              >
                {content}
              </button>
            ) : (
              <Badge key={author.author_id} variant="secondary" className="text-sm">
                {content}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopicSelect({
  blocks,
  value,
  onChange,
}: {
  blocks: TopicBlock[];
  value: string;
  onChange: (blockId: string) => void;
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">話題ブロックがありません。</p>
    );
  }

  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">話題ブロック</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {blocks.map((block) => (
          <option key={block.block_id} value={block.block_id}>
            #{block.block_index + 1} {block.label} ({formatSeconds(block.start_sec)} –{" "}
            {formatSeconds(block.end_sec)})
          </option>
        ))}
      </select>
    </label>
  );
}

function TopicAuthorsSection({
  videoId,
  blocks,
  selectedBlockId,
  onSelectBlock,
  initialIsMock,
  refreshKey = 0,
}: {
  videoId: string;
  blocks: TopicBlock[];
  selectedBlockId: string;
  onSelectBlock: (blockId: string) => void;
  initialIsMock: boolean;
  refreshKey?: number;
}) {
  const [topicAuthors, setTopicAuthors] = useState<AuthorsByTopicResponse | null>(null);
  const [topicIsMock, setTopicIsMock] = useState(initialIsMock);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedBlockId) return;

    let cancelled = false;
    setLoading(true);

    getAuthorsByTopicWithFallback(videoId, selectedBlockId)
      .then(({ data, isMock }) => {
        if (!cancelled) {
          setTopicAuthors(data);
          setTopicIsMock(isMock);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, selectedBlockId, refreshKey]);

  const selectedBlock = blocks.find((block) => block.block_id === selectedBlockId);

  return (
    <div className="space-y-4">
      <TopicSelect blocks={blocks} value={selectedBlockId} onChange={onSelectBlock} />
      {selectedBlock ? (
        <p className="text-xs text-muted-foreground">
          {selectedBlock.label}{" "}
          <span className="text-[10px]">(推定)</span>
          {" — "}
          {selectedBlock.label_note}
        </p>
      ) : null}
      {topicIsMock && !initialIsMock ? (
        <Alert>
          <Info />
          <AlertTitle>話題別データはサンプル表示</AlertTitle>
          <AlertDescription>
            話題別 Top 投稿者の API 取得に失敗したため、見本データを表示しています。
          </AlertDescription>
        </Alert>
      ) : null}
      {loading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : (
        <AuthorsTable items={topicAuthors?.items ?? []} />
      )}
    </div>
  );
}

export function CommunityTab({ videoId, refreshKey = 0 }: CommunityTabProps) {
  const [data, setData] = useState<CommunityTabData | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorItem | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const openAuthorProfile = (author: AuthorItem) => {
    setSelectedAuthor(author);
    setProfileOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getCommunityTabDataWithFallback(videoId)
      .then(({ data: tabData, isMock: mock }) => {
        if (!cancelled) {
          setData(tabData);
          setIsMock(mock);
          setSelectedBlockId(tabData.topics.items[0]?.block_id ?? "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>コミュニティ分析を読み込めませんでした</AlertTitle>
        <AlertDescription>しばらくしてから再度お試しください。</AlertDescription>
      </Alert>
    );
  }

  const blocks = data.topics.items;

  return (
    <div className="space-y-6">
      {isMock ? (
        <Alert>
          <Info />
          <AlertTitle>サンプルデータを表示中</AlertTitle>
          <AlertDescription>API 未接続のため、見本データで画面を表示しています。</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>全体 Top 投稿者</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthorsTable items={data.authors.items} onAuthorClick={openAuthorProfile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>常連コア層</CardTitle>
        </CardHeader>
        <CardContent>
          <CoreRegularSection authors={data.authors.items} onAuthorClick={openAuthorProfile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>話題別 Top 投稿者</CardTitle>
        </CardHeader>
        <CardContent>
          <TopicAuthorsSection
            videoId={videoId}
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            initialIsMock={isMock}
            refreshKey={refreshKey}
          />
        </CardContent>
      </Card>

      <AuthorProfileSheet
        videoId={videoId}
        authorId={selectedAuthor?.author_id ?? null}
        authorName={selectedAuthor?.author_name}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}
