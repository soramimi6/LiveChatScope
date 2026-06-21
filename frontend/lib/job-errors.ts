export type JobError = { code: string; message: string };

const ERROR_HINTS: Record<string, string> = {
  INTERRUPTED:
    "処理が中断されました。下の「再試行」から続行できます（取得済みの場合は分析のみ再開します）。",
  REPLAY_DISABLED: "この配信はチャットリプレイが無効のため取得できません。",
  VIDEO_NOT_FOUND: "動画が見つからないか、非公開の可能性があります。",
  FETCH_FAILED: "チャットの取得に失敗しました。",
  ANALYSIS_FAILED: "分析処理中にエラーが発生しました。",
};

export function formatJobError(error: JobError | null | undefined): string | null {
  if (!error) return null;
  return ERROR_HINTS[error.code] ?? error.message;
}

export function canRetryJob(status: {
  fetch_status: string;
  analysis_status: string;
  error: JobError | null;
}): boolean {
  if (status.error?.code === "REPLAY_DISABLED" || status.error?.code === "VIDEO_NOT_FOUND") {
    return false;
  }
  return status.fetch_status === "failed" || status.analysis_status === "failed";
}
