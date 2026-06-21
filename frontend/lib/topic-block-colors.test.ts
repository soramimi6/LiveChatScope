import { describe, expect, it } from "vitest";
import {
  TOPIC_BLOCK_COLOR_COUNT,
  TOPIC_BLOCK_COLORS,
  getTopicBlockColor,
} from "@/lib/topic-block-colors";

describe("topic-block-colors", () => {
  it("provides 20 unique colors", () => {
    expect(TOPIC_BLOCK_COLORS).toHaveLength(TOPIC_BLOCK_COLOR_COUNT);
    expect(new Set(TOPIC_BLOCK_COLORS).size).toBe(TOPIC_BLOCK_COLOR_COUNT);
  });

  it("wraps block index modulo palette size", () => {
    expect(getTopicBlockColor(0)).toBe(TOPIC_BLOCK_COLORS[0]);
    expect(getTopicBlockColor(20)).toBe(TOPIC_BLOCK_COLORS[0]);
    expect(getTopicBlockColor(21)).toBe(TOPIC_BLOCK_COLORS[1]);
  });
});
