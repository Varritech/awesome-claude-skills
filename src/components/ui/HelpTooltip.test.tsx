import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpTooltip } from "./HelpTooltip";

describe("HelpTooltip", () => {
  it("renders a ? trigger button", () => {
    render(<HelpTooltip content="Some help text" />);
    expect(screen.getByRole("button", { name: /help/i })).toBeInTheDocument();
  });

  it("does not show tooltip content by default", () => {
    render(<HelpTooltip content="Hidden tip" />);
    expect(screen.queryByText("Hidden tip")).not.toBeInTheDocument();
  });

  it("shows tooltip content on mouse enter", () => {
    render(<HelpTooltip content="Visible tip" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByText("Visible tip")).toBeInTheDocument();
  });

  it("hides tooltip content on mouse leave", () => {
    render(<HelpTooltip content="Tip goes away" />);
    const btn = screen.getByRole("button", { name: /help/i });
    fireEvent.mouseEnter(btn);
    expect(screen.getByText("Tip goes away")).toBeInTheDocument();
    fireEvent.mouseLeave(btn);
    expect(screen.queryByText("Tip goes away")).not.toBeInTheDocument();
  });

  it("accepts a position prop without crashing", () => {
    const { container } = render(<HelpTooltip content="Position test" position="bottom" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders all position variants", () => {
    const positions = ["top", "bottom", "left", "right"] as const;
    for (const position of positions) {
      const { unmount } = render(<HelpTooltip content="pos test" position={position} />);
      unmount();
    }
  });
});
