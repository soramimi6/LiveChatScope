"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { JumpLinkButton } from "@/components/jump-link-button";
import {
  getAuthorProfileWithFallback,
  type AuthorProfileResponse,
} from "@/lib/api/community";

type AuthorProfileSheetProps = {
  videoId: string;
  authorId: string | null;
  authorName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatSuperChatTotals(
  totals: AuthorProfileResponse["super_chat_total"],
): string {
  if (totals.length === 0) return "—";
  return totals
    .map((row) => `${row.amount.toLocaleString()} ${row.currency}（${row.count}件）`)
    .join(" / ");
}

function channelProfileUrl(authorId: string): string | null {
  if (authorId.startsWith("UC") && !authorId.startsWith("unknown:")) {
    return `https://www.youtube.com/channel/${authorId}`;
  }
  return null;
}

export function AuthorProfileSheet({
  videoId,
  authorId,
  authorName,
  open,
  onOpenChange,
}: AuthorProfileSheetProps) {
  const [profile, setProfile] = useState<AuthorProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !authorId) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getAuthorProfileWithFallback(videoId, authorId)
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, authorId, open]);

  const title = profile?.author_name ?? authorName ?? "投稿者プロフィール";
  const channelUrl = authorId ? channelProfileUrl(authorId) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="この配信における投稿傾向のサマリーです。"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">プロフィールを読み込めませんでした。</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">全体 #{profile.rank}</Badge>
            {profile.is_core_regular ? (
              <Badge variant="outline">常連コア層</Badge>
            ) : null}
            {profile.registered_during_stream ? (
              <Badge variant="outline">配信中に登録</Badge>
            ) : null}
            {profile.used_membership_gift ? (
              <Badge variant="outline">ギフト告知</Badge>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {profile.message_count.toLocaleString()} 件
            </span>
          </div>

          {channelUrl ? (
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
            >
              YouTube チャンネルを開く
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">話題ブロック参加</h3>
            <p className="text-sm text-muted-foreground">
              {profile.block_participation.participated_blocks} /{" "}
              {profile.block_participation.total_blocks} ブロック（
              {Math.round(profile.block_participation.ratio * 100)}%）
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">初回 / 最終発言</h3>
            <div className="space-y-2">
              {profile.first_message ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-xs text-muted-foreground">初回</p>
                    <p className="font-medium tabular-nums">{profile.first_message.time_text}</p>
                  </div>
                  <JumpLinkButton
                    jumpUrl={profile.first_message.jump_url}
                    timeText={profile.first_message.time_text}
                    size="xs"
                  />
                </div>
              ) : null}
              {profile.last_message ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-xs text-muted-foreground">最終</p>
                    <p className="font-medium tabular-nums">{profile.last_message.time_text}</p>
                  </div>
                  <JumpLinkButton
                    jumpUrl={profile.last_message.jump_url}
                    timeText={profile.last_message.time_text}
                    size="xs"
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">スパチャ</h3>
            <p className="text-sm">{formatSuperChatTotals(profile.super_chat_total)}</p>
          </section>

          {profile.membership_registration || profile.membership_gift ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">メンバーシップ</h3>
              <div className="space-y-2">
                {profile.membership_registration ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-xs text-muted-foreground">配信中に登録</p>
                      <p className="font-medium tabular-nums">
                        {profile.membership_registration.time_text}
                      </p>
                    </div>
                    <JumpLinkButton
                      jumpUrl={profile.membership_registration.jump_url}
                      timeText={profile.membership_registration.time_text}
                      size="xs"
                    />
                  </div>
                ) : null}
                {profile.membership_gift ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-xs text-muted-foreground">ギフト告知</p>
                      <p className="font-medium tabular-nums">
                        {profile.membership_gift.time_text}
                      </p>
                    </div>
                    <JumpLinkButton
                      jumpUrl={profile.membership_gift.jump_url}
                      timeText={profile.membership_gift.time_text}
                      size="xs"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">発言の多い話題</h3>
            {profile.top_topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">話題ブロックデータがありません。</p>
            ) : (
              <ol className="space-y-2">
                {profile.top_topics.map((topic, index) => (
                  <li
                    key={topic.block_id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {index + 1}. {topic.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {topic.message_count.toLocaleString()} 件
                      </p>
                    </div>
                    <JumpLinkButton jumpUrl={topic.jump_url} timeText={topic.label} size="xs" />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}
