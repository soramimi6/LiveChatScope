import { describe, expect, it } from "vitest";
import { formatSuperChatTotals } from "@/lib/topic-super-chat";

describe("formatSuperChatTotals", () => {
  it("joins currencies with line breaks", () => {
    expect(
      formatSuperChatTotals([
        { currency: "JPY", amount: 1000, count: 3 },
        { currency: "USD", amount: 50, count: 1 },
      ]),
    ).toBe("1,000 JPY（3件）\n50 USD（1件）");
  });

  it("returns em dash when empty", () => {
    expect(formatSuperChatTotals([])).toBe("—");
  });
});
