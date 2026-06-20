import { Badge } from "@/components/ui/badge";

/** analysis_status=partial 時 — ui-spec §6「基本分析のみ」 */
export function PartialAnalysisBadge() {
  return (
    <Badge variant="secondary" title="Phase A 基本分析のみ完了。A+ 分析は未完了です。">
      基本分析のみ
    </Badge>
  );
}
