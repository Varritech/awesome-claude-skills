import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Next.js modules
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { OnboardingLayout } from "./OnboardingLayout";

describe("OnboardingLayout", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <OnboardingLayout currentStep={1}>
        <div>Step content</div>
      </OnboardingLayout>
    );
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <OnboardingLayout currentStep={1}>
        <div>Onboarding page content</div>
      </OnboardingLayout>
    );
    expect(screen.getByText("Onboarding page content")).toBeInTheDocument();
  });

  it("renders the ConvergeFlow brand text", () => {
    render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    expect(screen.getByText("ConvergeFlow")).toBeInTheDocument();
  });

  it("renders step breadcrumb labels", () => {
    render(
      <OnboardingLayout currentStep={3}>
        <div>Content</div>
      </OnboardingLayout>
    );
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Domain")).toBeInTheDocument();
    expect(screen.getByText("Inboxes")).toBeInTheDocument();
    expect(screen.getByText("Niche")).toBeInTheDocument();
    expect(screen.getByText("Launch")).toBeInTheDocument();
  });

  it("renders step navigation links with correct hrefs", () => {
    render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/onboarding/path");
    expect(hrefs).toContain("/onboarding/domain");
    expect(hrefs).toContain("/onboarding/inbox");
    expect(hrefs).toContain("/onboarding/industry");
    expect(hrefs).toContain("/onboarding/style");
  });

  it("highlights the active step with bold white text", () => {
    render(
      <OnboardingLayout currentStep={2}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const domainLink = screen.getByText("Domain");
    expect(domainLink.className).toContain("text-white");
    expect(domainLink.className).toContain("font-bold");
  });

  it("styles completed steps differently from future steps", () => {
    render(
      <OnboardingLayout currentStep={3}>
        <div>Content</div>
      </OnboardingLayout>
    );
    // Step 1 (Account) is completed (before step 3)
    const accountLink = screen.getByText("Account");
    expect(accountLink.className).toContain("text-white/25");

    // Step 4 (Niche) is future (after step 3)
    const nicheLink = screen.getByText("Niche");
    expect(nicheLink.className).toContain("text-white/[0.12]");
  });

  it("renders progress bar with correct width for step 1", () => {
    const { container } = render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    // The progress fill div has inline style with width
    const progressFill = container.querySelector(
      "[class*='bg-gradient-to-r'][class*='from-cf-orange']"
    );
    expect(progressFill).toBeInTheDocument();
    expect(progressFill?.getAttribute("style")).toContain("width: 5%");
  });

  it("renders progress bar with correct width for step 3", () => {
    const { container } = render(
      <OnboardingLayout currentStep={3}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const progressFill = container.querySelector(
      "[class*='bg-gradient-to-r'][class*='from-cf-orange']"
    );
    expect(progressFill?.getAttribute("style")).toContain("width: 45%");
  });

  it("renders progress bar with correct width for step 5", () => {
    const { container } = render(
      <OnboardingLayout currentStep={5}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const progressFill = container.querySelector(
      "[class*='bg-gradient-to-r'][class*='from-cf-orange']"
    );
    expect(progressFill?.getAttribute("style")).toContain("width: 90%");
  });

  it("renders header as fixed element", () => {
    const { container } = render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("fixed");
  });

  it("renders main content area", () => {
    const { container } = render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders separator characters between steps", () => {
    render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    // There are 4 "/" separator characters between the 5 steps
    const separators = screen.getAllByText("/");
    expect(separators.length).toBe(4);
  });

  it("includes logo link pointing to home", () => {
    render(
      <OnboardingLayout currentStep={1}>
        <div>Content</div>
      </OnboardingLayout>
    );
    const links = screen.getAllByRole("link");
    const homeLink = links.find((l) => l.getAttribute("href") === "/");
    expect(homeLink).toBeInTheDocument();
  });
});
