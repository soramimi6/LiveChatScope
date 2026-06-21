const FETCH_STATUS_LABELS: Record<string, string> = {
  pending: "待機中",
  fetching: "取得中",
  fetched: "取得完了",
  failed: "失敗",
};

const ANALYSIS_STATUS_LABELS: Record<string, string> = {
  pending: "待機中",
  running: "分析中",
  partial: "基本分析のみ",
  complete: "完了",
  failed: "失敗",
};

export function formatFetchStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return FETCH_STATUS_LABELS[status] ?? status;
}

export function formatAnalysisStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ANALYSIS_STATUS_LABELS[status] ?? status;
}
