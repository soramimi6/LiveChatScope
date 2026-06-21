import { describe, expect, it } from "vitest";
import { splitTopicLabel } from "@/lib/topic-label";

describe("splitTopicLabel", () => {
  it("splits slash-separated labels", () => {
    expect(splitTopicLabel("ちょっと / mikoKusa / mikoGood")).toEqual([
      "ちょっと",
      "mikoKusa",
      "mikoGood",
    ]);
  });

  it("returns a single token when no separator", () => {
    expect(splitTopicLabel("雑談")).toEqual(["雑談"]);
  });
});
