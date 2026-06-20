import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type JumpLinkButtonProps = {
  jumpUrl: string;
  /** aria-label 用（例: 1:23:45） */
  timeText?: string;
  size?: "default" | "sm" | "xs";
  className?: string;
};

export function JumpLinkButton({
  jumpUrl,
  timeText,
  size = "sm",
  className,
}: JumpLinkButtonProps) {
  const ariaLabel = timeText
    ? `YouTube の ${timeText} から再生`
    : "YouTube で再生";

  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      render={
        <a
          href={jumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
        />
      }
    >
      <ExternalLink data-icon="inline-start" />
      YouTube で見る
    </Button>
  );
}
