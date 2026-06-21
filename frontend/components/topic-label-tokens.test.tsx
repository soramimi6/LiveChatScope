import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayFilterActionsProvider } from "@/components/display-filter-actions-context";
import { TopicLabelTokens } from "@/components/topic-label-tokens";

afterEach(() => {
  cleanup();
});

describe("TopicLabelTokens", () => {
  it("renders clickable tokens with NG help tooltip", () => {
    const addNgKeyword = vi.fn();

    render(
      <DisplayFilterActionsProvider
        value={{
          addNgKeyword,
          ngKeywords: [],
          updating: false,
        }}
      >
        <TopicLabelTokens label="ちょっと / mikoKusa / mikoGood" />
      </DisplayFilterActionsProvider>,
    );

    const token = screen.getByRole("button", { name: "mikoKusa をNGワードに追加して除外" });
    expect(token).toHaveAttribute("title", "クリックするとNGワードに追加して除外");

    fireEvent.click(token);
    expect(addNgKeyword).toHaveBeenCalledWith("mikoKusa");
  });

  it("disables tokens already in NG list", () => {
    render(
      <DisplayFilterActionsProvider
        value={{
          addNgKeyword: vi.fn(),
          ngKeywords: ["mikoKusa"],
          updating: false,
        }}
      >
        <TopicLabelTokens label="ちょっと / mikoKusa" />
      </DisplayFilterActionsProvider>,
    );

    expect(
      screen.getByRole("button", { name: "mikoKusa をNGワードに追加して除外" }),
    ).toBeDisabled();
  });
});
