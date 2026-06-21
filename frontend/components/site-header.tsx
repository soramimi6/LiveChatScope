import Link from "next/link";

type SiteHeaderProps = {
  title?: string;
  subtitle?: string;
  linkedVideoId?: string;
};

export function SiteHeader({ title, subtitle, linkedVideoId }: SiteHeaderProps) {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            LiveChatScope
          </Link>
          {linkedVideoId ? (
            <p className="truncate text-sm text-muted-foreground">
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
            <p className="truncate text-sm text-muted-foreground">{title}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              配信後のチャットを、振り返り資料に。
            </p>
          )}
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm text-primary hover:underline"
        >
          別の URL を分析
        </Link>
      </div>
    </header>
  );
}
