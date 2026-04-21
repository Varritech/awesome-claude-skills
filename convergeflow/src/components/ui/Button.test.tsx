import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with default variant", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders primary variant with orange background", () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-cf-orange");
  });

  it("renders mint variant", () => {
    const { container } = render(<Button variant="mint">Mint</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-cf-mint");
  });

  it("renders small size", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("text-xs");
  });

  it("renders with icon", () => {
    const { container } = render(
      <Button icon={<span data-testid="icon">+</span>}>With Icon</Button>
    );
    expect(container.querySelector("[data-testid='icon']")).toBeInTheDocument();
  });

  it("passes through button props", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});