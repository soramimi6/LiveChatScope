import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function RefilterPendingBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 border-orange-500 bg-orange-400 font-medium text-black hover:bg-orange-400"
    >
      <Loader2 className="size-3 animate-spin text-black" aria-hidden />
      反映中
    </Badge>
  );
}
