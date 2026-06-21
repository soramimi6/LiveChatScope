export function formatSeconds(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type StreamPositionFormat = {
  percent: number | null;
  phaseLabel: string | null;
  text: string;
};

export function formatStreamPosition(
  seconds: number,
  durationSeconds?: number | null,
): StreamPositionFormat {
  const timeText = formatSeconds(seconds);

  if (durationSeconds == null || durationSeconds <= 0) {
    return { percent: null, phaseLabel: null, text: timeText };
  }

  const percent = Math.min(
    100,
    Math.max(0, Math.round((seconds / durationSeconds) * 100)),
  );

  let phaseLabel: string;
  if (percent < 33) {
    phaseLabel = "序盤";
  } else if (percent < 66) {
    phaseLabel = "中盤";
  } else {
    phaseLabel = "終盤";
  }

  return {
    percent,
    phaseLabel,
    text: `${percent}%（${phaseLabel}）`,
  };
}

export function youtubeJumpUrl(videoId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`;
}
