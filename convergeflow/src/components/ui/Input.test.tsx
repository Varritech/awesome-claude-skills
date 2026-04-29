import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("applies default state classes", () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("bg-cf-card");
    expect(input.className).toContain("text-white/35");
  });

  it("applies filled state classes", () => {
    render(<Input state="filled" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("text-white");
    expect(input.className).not.toContain("text-white/35");
  });

  it("applies focused state classes", () => {
    render(<Input state="focused" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("border-cf-orange");
  });

  it("applies error state classes", () => {
    render(<Input state="error" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("border-cf-red");
    expect(input.className).toContain("text-cf-red");
  });

  it("renders left icon when provided", () => {
    render(
      <Input leftIcon={<span data-testid="left-icon">@</span>} />
    );
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  it("adds left padding when leftIcon is present", () => {
    render(
      <Input leftIcon={<span>@</span>} data-testid="input" />
    );
    const input = screen.getByTestId("input");
    expect(input.className).toContain("pl-11");
  });

  it("does not add left padding without leftIcon", () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).not.toContain("pl-11");
  });

  it("does not render left icon wrapper when no icon provided", () => {
    const { container } = render(<Input />);
    // The wrapper div only has the input, no icon wrapper
    const wrapperChildren = container.firstElementChild!.children;
    expect(wrapperChildren.length).toBe(1); // Just the input
  });

  it("merges custom className onto input element", () => {
    render(<Input className="custom-input" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("custom-input");
  });

  it("forwards ref", () => {
    let ref: HTMLInputElement | null = null;
    render(<Input ref={(el) => { ref = el; }} />);
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through native input props", () => {
    render(<Input type="email" name="user-email" required data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("name", "user-email");
    expect(input).toBeRequired();
  });

  it("supports disabled state", () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId("input")).toBeDisabled();
  });

  it("wraps input in a relative div", () => {
    const { container } = render(<Input />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toContain("relative");
  });
});
