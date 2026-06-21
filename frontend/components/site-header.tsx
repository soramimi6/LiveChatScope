import Link from "next/link";
import Image from "next/image";

type SiteHeaderProps = {
  title?: string;
  subtitle?: string;
  /** When set with title, the title links to this YouTube video. */
  videoId?: string;
  linkedVideoId?: string;
};

export function SiteHeader({ title, subtitle, videoId, linkedVideoId }: SiteHeaderProps) {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-6 px-4 py-3.5 sm:px-6">
        <div className="min-w-0 space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-sm transition-opacity hover:opacity-90"
          >
            <Image
              src="/logo.svg"
              alt=""
              width={32}
              height={32}
              className="shrink-0"
              priority
            />
            <span className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              LiveChatScope
            </span>
          </Link>
          {linkedVideoId ? (
            <p className="truncate pl-[2.625rem] text-sm leading-snug text-muted-foreground">
              動画 ID:{" "}
              <a
                href={`https://www.youtube.com/watch?v=${linkedVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {linkedVideoId}
              </a>
            </p>
          ) : title ? (
            <p className="truncate pl-[2.625rem] text-sm leading-snug text-muted-foreground">
              {videoId ? (
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:text-primary hover:underline"
                  title="YouTube で開く"
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </p>
          ) : (
            <p className="pl-[2.625rem] text-sm leading-snug text-muted-foreground">
              配信後のチャットを、振り返り資料に。
            </p>
          )}
          {subtitle ? (
            <p className="truncate pl-[2.625rem] text-xs leading-snug text-muted-foreground/80">
              {subtitle}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="shrink-0 pt-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          別の URL を分析
        </Link>
      </div>
    </header>
  );
}
