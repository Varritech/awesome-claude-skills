import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  HomeIcon,
  MailIcon,
  UsersIcon,
  SearchIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
  LogoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SettingsIcon,
  ShieldIcon,
} from "./Icon";

describe("Icon components", () => {
  describe("HomeIcon", () => {
    it("renders an SVG element", () => {
      const { container } = render(<HomeIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("uses default size of 20", () => {
      const { container } = render(<HomeIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "20");
      expect(svg).toHaveAttribute("height", "20");
    });

    it("accepts custom size", () => {
      const { container } = render(<HomeIcon size={32} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
    });

    it("has correct viewBox", () => {
      const { container } = render(<HomeIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    });

    it("uses stroke for rendering", () => {
      const { container } = render(<HomeIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("stroke", "currentColor");
      expect(svg).toHaveAttribute("fill", "none");
    });

    it("contains path elements", () => {
      const { container } = render(<HomeIcon />);
      const paths = container.querySelectorAll("path, polyline");
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("MailIcon", () => {
    it("renders an SVG element", () => {
      const { container } = render(<MailIcon />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("contains rect and path elements", () => {
      const { container } = render(<MailIcon />);
      expect(container.querySelector("rect")).toBeInTheDocument();
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("UsersIcon", () => {
    it("renders an SVG element", () => {
      const { container } = render(<UsersIcon />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("contains a circle element for the head", () => {
      const { container } = render(<UsersIcon />);
      expect(container.querySelector("circle")).toBeInTheDocument();
    });
  });

  describe("SearchIcon", () => {
    it("renders an SVG with circle and path", () => {
      const { container } = render(<SearchIcon />);
      expect(container.querySelector("circle")).toBeInTheDocument();
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("PlusIcon", () => {
    it("renders an SVG with a path", () => {
      const { container } = render(<PlusIcon />);
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("CheckIcon", () => {
    it("renders an SVG with a polyline", () => {
      const { container } = render(<CheckIcon />);
      expect(container.querySelector("polyline")).toBeInTheDocument();
    });
  });

  describe("XIcon", () => {
    it("renders an SVG with two paths for the X shape", () => {
      const { container } = render(<XIcon />);
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(2);
    });
  });

  describe("LogoIcon", () => {
    it("renders the double chevron logo", () => {
      const { container } = render(<LogoIcon />);
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(2);
    });

    it("accepts custom size", () => {
      const { container } = render(<LogoIcon size={16} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("height", "16");
    });
  });

  describe("ChevronLeftIcon", () => {
    it("renders an SVG with a path", () => {
      const { container } = render(<ChevronLeftIcon />);
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("ChevronRightIcon", () => {
    it("renders an SVG with a path", () => {
      const { container } = render(<ChevronRightIcon />);
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("SettingsIcon", () => {
    it("renders an SVG with circle and path", () => {
      const { container } = render(<SettingsIcon />);
      expect(container.querySelector("circle")).toBeInTheDocument();
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("ShieldIcon", () => {
    it("renders an SVG with a path", () => {
      const { container } = render(<ShieldIcon />);
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("common icon props", () => {
    it("passes through SVG attributes like className", () => {
      const { container } = render(<HomeIcon className="text-red-500" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("class")).toContain("text-red-500");
    });

    it("passes through aria-label", () => {
      const { container } = render(<HomeIcon aria-label="Home" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-label", "Home");
    });

    it("has strokeLinecap round", () => {
      const { container } = render(<HomeIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("stroke-linecap", "round");
    });

    it("has strokeLinejoin round", () => {
      const { container } = render(<HomeIcon />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("stroke-linejoin", "round");
    });
  });
});
