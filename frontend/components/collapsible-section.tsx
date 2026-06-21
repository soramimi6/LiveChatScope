"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  count: number;
  countLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

export function CollapsibleSection({
  title,
  count,
  countLabel = "人",
  children,
  defaultOpen = false,
  className,
}: CollapsibleSectionProps) {
  return (
    <details className={cn("group rounded-lg border", className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
        <span className="min-w-0 flex-1 font-medium">
          {title}（{count.toLocaleString()} {countLabel}）
        </span>
        <span className="hidden text-xs text-muted-foreground group-open:hidden sm:inline">
          クリックで一覧を表示
        </span>
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}
