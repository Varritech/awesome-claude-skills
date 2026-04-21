import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, MenuDot } from "./Avatar";

describe("Avatar", () => {
  it("renders initials", () => {
    render(<Avatar initials="JR" />);
    expect(screen.getByText("JR")).toBeInTheDocument();
  });

  it("renders icon instead of initials when icon is provided", () => {
    render(
      <Avatar
        icon={<span data-testid="avatar-icon">ic</span>}
        initials="JR"
      />
    );
    expect(screen.getByTestId("avatar-icon")).toBeInTheDocument();
    // Icon takes precedence over initials
    expect(screen.queryByText("JR")).not.toBeInTheDocument();
  });

  it("renders without initials or icon", () => {
    const { container } = render(<Avatar />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.textContent).toBe("");
  });

  it("applies default variant (orange)", () => {
    const { container } = render(<Avatar initials="AB" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("from-cf-orange");
  });

  it("applies indigo variant", () => {
    const { container } = render(<Avatar initials="AB" variant="indigo" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("from-cf-indigo");
  });

  it("applies icon variant", () => {
    const { container } = render(<Avatar initials="AB" variant="icon" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-white/6");
  });

  it("applies mint variant", () => {
    const { container } = render(<Avatar initials="AB" variant="mint" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-cf-mint");
  });

  it("applies default size (md)", () => {
    const { container } = render(<Avatar initials="AB" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-10");
    expect(el.className).toContain("h-10");
  });

  it("applies sm size", () => {
    const { container } = render(<Avatar initials="AB" size="sm" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-9");
    expect(el.className).toContain("h-9");
    expect(el.className).toContain("text-xs");
  });

  it("applies lg size", () => {
    const { container } = render(<Avatar initials="AB" size="lg" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("w-14");
    expect(el.className).toContain("h-14");
    expect(el.className).toContain("text-xl");
  });

  it("has rounded-full class", () => {
    const { container } = render(<Avatar initials="AB" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("rounded-full");
  });

  it("merges custom className", () => {
    const { container } = render(<Avatar initials="AB" className="my-avatar" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("my-avatar");
  });
});

describe("MenuDot", () => {
  it("renders three dots", () => {
    const { container } = render(<MenuDot />);
    const dots = container.querySelectorAll(".rounded-full");
    expect(dots.length).toBe(3);
  });

  it("has cursor-pointer class", () => {
    const { container } = render(<MenuDot />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("cursor-pointer");
  });

  it("merges custom className", () => {
    const { container } = render(<MenuDot className="extra" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("extra");
  });
});
