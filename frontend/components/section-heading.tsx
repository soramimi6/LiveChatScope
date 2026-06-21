import { CardTitle } from "@/components/ui/card";
import { RefilterPendingBadge } from "@/components/refilter-pending-badge";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  title: string;
  refilterPending?: boolean;
  as?: "card" | "section";
  className?: string;
};

export function SectionHeading({
  title,
  refilterPending = false,
  as = "card",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {as === "card" ? (
        <CardTitle>{title}</CardTitle>
      ) : (
        <h3 className="text-sm font-medium">{title}</h3>
      )}
      {refilterPending ? <RefilterPendingBadge /> : null}
    </div>
  );
}
