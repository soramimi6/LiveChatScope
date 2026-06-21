/** Matches backend default `topic_max_blocks`. */
export const TOPIC_BLOCK_COLOR_COUNT = 20;

/**
 * Distinct hues for topic timeline segments and legend swatches.
 * First 8 preserved from the original palette for familiar colors on short streams.
 */
export const TOPIC_BLOCK_COLORS: readonly string[] = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#84cc16",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#0ea5e9",
  "#22c55e",
  "#ca8a04",
  "#f43f5e",
  "#64748b",
  "#d946ef",
  "#0891b2",
  "#c026d3",
] as const;

export function getTopicBlockColor(blockIndex: number): string {
  if (TOPIC_BLOCK_COLORS.length === 0) {
    return "#3b82f6";
  }
  const normalized =
    ((blockIndex % TOPIC_BLOCK_COLORS.length) + TOPIC_BLOCK_COLORS.length) %
    TOPIC_BLOCK_COLORS.length;
  return TOPIC_BLOCK_COLORS[normalized];
}
