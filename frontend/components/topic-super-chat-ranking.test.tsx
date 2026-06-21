import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayFilterActionsProvider } from "@/components/display-filter-actions-context";
import { TopicSuperChatRanking } from "@/components/topic-super-chat-ranking";
import type { TopicBlock } from "@/lib/api";

afterEach(() => {
  cleanup();
});

const block: TopicBlock = {
  block_id: "b1",
  block_index: 0,
  start_sec: 120,
  end_sec: 600,
  label: "ゲーム実況 / ボス戦",
  label_note: "推定ラベル",
  message_count: 100,
  unique_authors: 40,
  jump_url: "https://youtube.com/watch?v=x&t=120",
  super_chat_total: [{ currency: "JPY", amount: 5000, count: 3 }],
};

describe("TopicSuperChatRanking", () => {
  it("adds topic token to NG keywords on click", () => {
    const addNgKeyword = vi.fn();

    render(
      <DisplayFilterActionsProvider
        value={{
          addNgKeyword,
          ngKeywords: [],
          updating: false,
        }}
      >
        <TopicSuperChatRanking blocks={[block]} interactiveLabels />
      </DisplayFilterActionsProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "ゲーム実況 をNGワードに追加して除外" }),
    );
    expect(addNgKeyword).toHaveBeenCalledWith("ゲーム実況");
  });
});
