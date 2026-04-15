import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, MetricCard, ActionCard } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies default variant class", () => {
    const { container } = render(<Card>Default</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-cf-card");
  });

  it("applies elevated variant class", () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-cf-elevated");
  });

  it("applies mint variant class", () => {
    const { container } = render(<Card variant="mint">Mint</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("bg-cf-mint");
    expect(el.className).toContain("text-cf-card");
  });

  it("applies orange variant class", () => {
    const { container } = render(<Card variant="orange">Orange</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("from-cf-orange/20");
  });

  it("applies default padding (md)", () => {
    const { container } = render(<Card>Padded</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-6");
  });

  it("applies none padding", () => {
    const { container } = render(<Card padding="none">No pad</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).not.toContain("p-4");
    expect(el.className).not.toContain("p-6");
    expect(el.className).not.toContain("p-8");
  });

  it("applies sm padding", () => {
    const { container } = render(<Card padding="sm">Small pad</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-4");
  });

  it("applies lg padding", () => {
    const { container } = render(<Card padding="lg">Large pad</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("p-8");
  });

  it("applies rounded-cf-card class", () => {
    const { container } = render(<Card>Rounded</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("rounded-cf-card");
  });

  it("merges custom className", () => {
    const { container } = render(<Card className="my-custom">Custom</Card>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("my-custom");
    expect(el.className).toContain("bg-cf-card");
  });

  it("forwards ref", () => {
    let ref: HTMLDivElement | null = null;
    render(<Card ref={(el) => { ref = el; }}>Ref test</Card>);
    expect(ref).toBeInstanceOf(HTMLDivElement);
  });

  it("passes through HTML div props", () => {
    render(<Card data-testid="card-el" aria-label="Test card">Props</Card>);
    const el = screen.getByTestId("card-el");
    expect(el).toHaveAttribute("aria-label", "Test card");
  });
});

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Open Rate" value="24%" />);
    expect(screen.getByText("Open Rate")).toBeInTheDocument();
    expect(screen.getByText("24%")).toBeInTheDocument();
  });

  it("renders numeric value", () => {
    render(<MetricCard label="Clicks" value={1024} />);
    expect(screen.getByText("1024")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<MetricCard label="Leads" value={42} subtitle="+5 today" />);
    expect(screen.getByText("+5 today")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    const { container } = render(<MetricCard label="Test" value="0" />);
    const subtitles = container.querySelectorAll("p");
    // Should have 2 p tags: label + value paragraph (value is in p.text-4xl)
    // No subtitle paragraph
    const texts = Array.from(subtitles).map((p) => p.textContent);
    expect(texts).not.toContain("+5 today");
  });

  it("applies green accent to subtitle", () => {
    render(
      <MetricCard label="Test" value="10" subtitle="Up" accent="green" />
    );
    const subtitle = screen.getByText("Up");
    expect(subtitle.className).toContain("text-cf-green");
  });

  it("applies amber accent to subtitle", () => {
    render(<MetricCard label="Test" value="10" subtitle="Flat" accent="amber" />);
    const subtitle = screen.getByText("Flat");
    expect(subtitle.className).toContain("text-cf-amber");
  });

  it("applies default accent styling to subtitle", () => {
    render(<MetricCard label="Test" value="10" subtitle="Neutral" accent="indigo" />);
    const subtitle = screen.getByText("Neutral");
    expect(subtitle.className).toContain("text-white/15");
  });

  it("renders chart node when provided", () => {
    render(
      <MetricCard
        label="Test"
        value="50"
        chart={<div data-testid="chart">chart</div>}
      />
    );
    expect(screen.getByTestId("chart")).toBeInTheDocument();
  });

  it("forwards ref", () => {
    let ref: HTMLDivElement | null = null;
    render(<MetricCard ref={(el) => { ref = el; }} label="Ref" value="1" />);
    expect(ref).toBeInstanceOf(HTMLDivElement);
  });

  it("merges custom className", () => {
    const { container } = render(
      <MetricCard label="L" value="V" className="extra-class" />
    );
    // The outermost div is the Card wrapper
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("extra-class");
  });
});

describe("ActionCard", () => {
  it("renders icon, title, and description", () => {
    render(
      <ActionCard
        icon={<span data-testid="action-icon">*</span>}
        title="Create Email"
        description="Start a new campaign"
      />
    );
    expect(screen.getByTestId("action-icon")).toBeInTheDocument();
    expect(screen.getByText("Create Email")).toBeInTheDocument();
    expect(screen.getByText("Start a new campaign")).toBeInTheDocument();
  });

  it("has cursor-pointer class for clickable appearance", () => {
    const { container } = render(
      <ActionCard
        icon={<span>I</span>}
        title="T"
        description="D"
      />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("cursor-pointer");
  });

  it("contains a chevron SVG", () => {
    const { container } = render(
      <ActionCard icon={<span>I</span>} title="T" description="D" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("forwards ref", () => {
    let ref: HTMLDivElement | null = null;
    render(
      <ActionCard
        ref={(el) => { ref = el; }}
        icon={<span>I</span>}
        title="T"
        description="D"
      />
    );
    expect(ref).toBeInstanceOf(HTMLDivElement);
  });

  it("merges custom className", () => {
    const { container } = render(
      <ActionCard
        icon={<span>I</span>}
        title="T"
        description="D"
        className="test-class"
      />
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("test-class");
  });

  it("passes through HTML div props", () => {
    render(
      <ActionCard
        icon={<span>I</span>}
        title="T"
        description="D"
        data-testid="action-card"
        aria-label="Action"
      />
    );
    const el = screen.getByTestId("action-card");
    expect(el).toHaveAttribute("aria-label", "Action");
  });
});
