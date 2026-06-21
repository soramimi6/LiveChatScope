import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  description?: string;
  className?: string;
  onClick?: () => void;
};

export function KpiCard({
  title,
  value,
  description,
  className,
  onClick,
}: KpiCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        "min-w-0",
        interactive &&
          "cursor-pointer transition-shadow hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-normal text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
        {interactive ? (
          <p className="text-[10px] text-muted-foreground">クリックで明細</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
