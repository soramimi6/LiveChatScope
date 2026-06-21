import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SectionHeading } from "@/components/section-heading";

describe("SectionHeading", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows refilter pending badge when requested", () => {
    render(<SectionHeading title="構成タイムライン" refilterPending />);
    expect(screen.getByText("構成タイムライン")).toBeInTheDocument();
    expect(screen.getByText("反映中")).toBeInTheDocument();
  });

  it("hides badge when not pending", () => {
    render(<SectionHeading title="構成タイムライン" />);
    expect(screen.queryByText("反映中")).not.toBeInTheDocument();
  });
});
