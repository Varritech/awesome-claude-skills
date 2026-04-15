import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, CountBadge } from "./Badge";

describe("Badge", () => {
  it("renders pill variant with text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies mint color styles", () => {
    const { container } = render(<Badge color="mint">Selected</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-cf-mint");
  });

  it("renders status variant with dot", () => {
    const { container } = render(<Badge variant="status" color="green">Active</Badge>);
    const dot = container.querySelector(".bg-cf-green");
    expect(dot).toBeInTheDocument();
  });
});

describe("CountBadge", () => {
  it("renders count text", () => {
    render(<CountBadge>+43%</CountBadge>);
    expect(screen.getByText("+43%")).toBeInTheDocument();
  });

  it("applies green color", () => {
    const { container } = render(<CountBadge color="green">+43%</CountBadge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-cf-green");
  });
});