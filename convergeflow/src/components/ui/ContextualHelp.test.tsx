import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextualHelp } from "./ContextualHelp";

describe("ContextualHelp", () => {
  it("renders collapsed by default", () => {
    render(<ContextualHelp articleId="test-article" />);
    // The expand trigger should be visible
    expect(screen.getByRole("button")).toBeInTheDocument();
    // Content should not be visible
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("expands when clicked", () => {
    render(<ContextualHelp articleId="test-article" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("collapses when clicked again", () => {
    render(<ContextualHelp articleId="test-article" />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(screen.getByRole("region")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("renders with a custom label", () => {
    render(<ContextualHelp articleId="custom" label="Learn more" />);
    expect(screen.getByText(/learn more/i)).toBeInTheDocument();
  });

  it("renders with children as help content when expanded", () => {
    render(
      <ContextualHelp articleId="with-children">
        <p>Inline help text here</p>
      </ContextualHelp>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Inline help text here")).toBeInTheDocument();
  });
});
