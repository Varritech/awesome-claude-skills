import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RingProgress,
  DonutChart,
  Gauge,
  BarChart,
  Sparkline,
  MiniRing,
  AnimatedCounter,
} from "./Charts";

describe("RingProgress", () => {
  it("renders without crashing", () => {
    const { container } = render(<RingProgress percentage={75} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays percentage text", () => {
    render(<RingProgress percentage={75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<RingProgress percentage={50} label="Open Rate" />);
    expect(screen.getByText("Open Rate")).toBeInTheDocument();
  });

  it("does not render label when not provided", () => {
    const { container } = render(<RingProgress percentage={50} />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });

  it("uses custom size", () => {
    const { container } = render(<RingProgress percentage={50} size={100} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "100");
    expect(svg).toHaveAttribute("height", "100");
  });

  it("applies custom className", () => {
    const { container } = render(
      <RingProgress percentage={50} className="my-ring" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("my-ring");
  });

  it("renders two circle elements (bg + progress)", () => {
    const { container } = render(<RingProgress percentage={50} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });
});

describe("DonutChart", () => {
  const segments = [
    { value: 60, color: "#F97316", label: "Email" },
    { value: 30, color: "#B8D8CA", label: "Social" },
    { value: 10, color: "#6366F1", label: "Other" },
  ];

  it("renders without crashing", () => {
    const { container } = render(<DonutChart segments={segments} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders correct number of segment circles plus background", () => {
    const { container } = render(<DonutChart segments={segments} />);
    const circles = container.querySelectorAll("circle");
    // 1 bg + 3 segments
    expect(circles.length).toBe(4);
  });

  it("renders center label when provided", () => {
    render(<DonutChart segments={segments} centerLabel="100" />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders center sublabel when provided", () => {
    render(
      <DonutChart segments={segments} centerSublabel="total emails" />
    );
    expect(screen.getByText("total emails")).toBeInTheDocument();
  });

  it("does not render center label when not provided", () => {
    const { container } = render(<DonutChart segments={segments} />);
    const texts = container.querySelectorAll("text");
    expect(texts.length).toBe(0);
  });

  it("applies custom className", () => {
    const { container } = render(
      <DonutChart segments={segments} className="my-donut" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("my-donut");
  });

  it("uses custom size", () => {
    const { container } = render(
      <DonutChart segments={segments} size={200} />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "200");
    expect(svg).toHaveAttribute("height", "200");
  });
});

describe("Gauge", () => {
  it("renders without crashing", () => {
    const { container } = render(<Gauge value={72} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays the value percentage", () => {
    render(<Gauge value={72} />);
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Gauge value={50} label="Health" />);
    expect(screen.getByText("Health")).toBeInTheDocument();
  });

  it("renders statusText when provided", () => {
    render(<Gauge value={90} statusText="Excellent" />);
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("does not render label or statusText when not provided", () => {
    const { container } = render(<Gauge value={50} />);
    // Only the value paragraph
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(1); // Just the value
  });

  it("renders needle (line element)", () => {
    const { container } = render(<Gauge value={50} />);
    const line = container.querySelector("line");
    expect(line).toBeInTheDocument();
  });

  it("renders center dot (circle element)", () => {
    const { container } = render(<Gauge value={50} />);
    const circle = container.querySelector("circle");
    expect(circle).toBeInTheDocument();
  });

  it("renders min and max labels", () => {
    render(<Gauge value={50} max={100} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Gauge value={50} className="my-gauge" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("my-gauge");
  });
});

describe("BarChart", () => {
  const data = [
    { label: "Mon", value: 10 },
    { label: "Tue", value: 25, isHighlighted: true },
    { label: "Wed", value: 15 },
  ];

  it("renders without crashing", () => {
    const { container } = render(<BarChart data={data} />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("renders correct number of bar labels", () => {
    render(<BarChart data={data} />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
  });

  it("renders highlighted bar value tooltip", () => {
    render(<BarChart data={data} />);
    // The highlighted bar shows its value in a tooltip div
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<BarChart data={data} className="my-bar" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("my-bar");
  });

  it("renders one column per data item", () => {
    const { container } = render(<BarChart data={data} />);
    // Each data point has a label span
    const labels = container.querySelectorAll("span");
    expect(labels.length).toBe(3);
  });
});

describe("Sparkline", () => {
  const data = [10, 15, 8, 20, 12];

  it("renders without crashing", () => {
    const { container } = render(<Sparkline data={data} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a path element", () => {
    const { container } = render(<Sparkline data={data} />);
    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
  });

  it("uses default width and height", () => {
    const { container } = render(<Sparkline data={data} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("uses custom width and height", () => {
    const { container } = render(
      <Sparkline data={data} width={100} height={50} />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "100");
    expect(svg).toHaveAttribute("height", "50");
  });

  it("applies custom color", () => {
    const { container } = render(
      <Sparkline data={data} color="#00FF00" />
    );
    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke", "#00FF00");
  });

  it("applies custom className", () => {
    const { container } = render(
      <Sparkline data={data} className="my-spark" />
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("my-spark");
  });
});

describe("MiniRing", () => {
  it("renders without crashing", () => {
    const { container } = render(<MiniRing percentage={60} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders two circle elements (bg + progress)", () => {
    const { container } = render(<MiniRing percentage={60} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  it("renders label when provided", () => {
    render(<MiniRing percentage={60} label="60%" />);
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("does not render label text when not provided", () => {
    const { container } = render(<MiniRing percentage={60} />);
    const texts = container.querySelectorAll("text");
    expect(texts.length).toBe(0);
  });

  it("uses default size", () => {
    const { container } = render(<MiniRing percentage={60} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("uses custom size", () => {
    const { container } = render(<MiniRing percentage={60} size={80} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "80");
    expect(svg).toHaveAttribute("height", "80");
  });

  it("applies custom color to progress circle", () => {
    const { container } = render(
      <MiniRing percentage={60} color="#B8D8CA" />
    );
    const circles = container.querySelectorAll("circle");
    expect(circles[1]).toHaveAttribute("stroke", "#B8D8CA");
  });

  it("applies custom className", () => {
    const { container } = render(
      <MiniRing percentage={60} className="my-mini" />
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("my-mini");
  });
});

describe("AnimatedCounter", () => {
  it("renders without crashing", () => {
    const { container } = render(<AnimatedCounter target={100} />);
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("renders prefix and suffix", () => {
    render(<AnimatedCounter target={50} prefix="$" suffix="k" />);
    const span = screen.getByText(/\$/);
    expect(span.textContent).toContain("$");
    expect(span.textContent).toContain("k");
  });

  it("applies custom className", () => {
    const { container } = render(
      <AnimatedCounter target={100} className="my-counter" />
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("my-counter");
  });

  it("starts at 0", () => {
    const { container } = render(<AnimatedCounter target={100} />);
    const span = container.querySelector("span");
    // Initial render should start at 0
    expect(span?.textContent).toContain("0");
  });
});
