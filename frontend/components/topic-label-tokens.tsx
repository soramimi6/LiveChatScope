"use client";

import { Badge } from "@/components/ui/badge";
import { useDisplayFilterActions } from "@/components/display-filter-actions-context";
import { splitTopicLabel } from "@/lib/topic-label";
import { cn } from "@/lib/utils";

const NG_TOKEN_HELP = "クリックするとNGワードに追加して除外";

type TopicLabelTokensProps = {
  label: string;
  labelNote?: string;
  interactive?: boolean;
  showEstimatedBadge?: boolean;
  className?: string;
};

function isNgKeyword(token: string, ngKeywords: readonly string[]): boolean {
  const key = token.toLowerCase();
  return ngKeywords.some((keyword) => keyword.toLowerCase() === key);
}

export function TopicLabelTokens({
  label,
  labelNote,
  interactive = true,
  showEstimatedBadge = true,
  className,
}: TopicLabelTokensProps) {
  const filterActions = useDisplayFilterActions();
  const tokens = splitTopicLabel(label);
  const canAddNg =
    interactive &&
    filterActions != null &&
    !filterActions.updating;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {tokens.map((token, index) => {
        const alreadyNg =
          filterActions != null && isNgKeyword(token, filterActions.ngKeywords);

        if (!canAddNg) {
          return (
            <span key={`${token}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground">
                  /
                </span>
              ) : null}
              <span title={labelNote}>{token}</span>
            </span>
          );
        }

        return (
          <span key={`${token}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <span aria-hidden className="text-muted-foreground">
                /
              </span>
            ) : null}
            <button
              type="button"
              title={NG_TOKEN_HELP}
              aria-label={`${token} をNGワードに追加して除外`}
              disabled={alreadyNg || filterActions.updating}
              onClick={() => filterActions.addNgKeyword(token)}
              className={cn(
                "rounded px-1 py-0.5 text-left transition-colors",
                "hover:bg-destructive/10 hover:text-destructive",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-inherit",
                alreadyNg && "line-through",
              )}
            >
              {token}
            </button>
          </span>
        );
      })}
      {showEstimatedBadge ? (
        <Badge variant="outline" className="ml-1 shrink-0 text-[10px]">
          推定
        </Badge>
      ) : null}
    </div>
  );
}
