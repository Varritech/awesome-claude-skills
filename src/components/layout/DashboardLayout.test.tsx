import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Next.js modules before importing the components
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { firstName: "John", lastName: "Roe", imageUrl: null }, isLoaded: true }),
  useAuth: () => ({ isSignedIn: true }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

import { DashboardLayout, Sidebar, MobileNav } from "./DashboardLayout";

describe("DashboardLayout", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Page content</div>
      </DashboardLayout>
    );
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <DashboardLayout>
        <div>Dashboard page</div>
      </DashboardLayout>
    );
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("renders the sidebar", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
  });

  it("renders the mobile nav", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );
    // Mobile nav is a nav element
    const navElements = container.querySelectorAll("nav");
    // At least 2: sidebar nav + mobile nav
    expect(navElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders main element with content wrapper", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("applies min-h-screen and flex layout", () => {
    const { container } = render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("min-h-screen");
    expect(outer.className).toContain("flex");
  });
});

describe("Sidebar", () => {
  it("renders without crashing", () => {
    const { container } = render(<Sidebar />);
    expect(container.querySelector("aside")).toBeInTheDocument();
  });

  it("renders the logo link pointing to dashboard", () => {
    render(<Sidebar />);
    const links = screen.getAllByRole("link");
    const logoLink = links.find((link) => link.getAttribute("href") === "/dashboard");
    expect(logoLink).toBeInTheDocument();
  });

  it("renders navigation links for all nav items", () => {
    render(<Sidebar />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/emails");
    expect(hrefs).toContain("/customers");
    expect(hrefs).toContain("/styles");
    expect(hrefs).toContain("/analytics");
    expect(hrefs).toContain("/deliverability");
  });

  it("renders help and settings links", () => {
    render(<Sidebar />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/help");
    expect(hrefs).toContain("/settings");
  });

  it("renders the user avatar with initials JR", () => {
    render(<Sidebar />);
    expect(screen.getByText("JR")).toBeInTheDocument();
  });

  it("highlights the active nav item based on pathname", () => {
    // pathname is mocked to "/dashboard"
    const { container } = render(<Sidebar />);
    // The active link should have bg-cf-orange/10 class
    const links = container.querySelectorAll("a");
    const dashboardLinks = Array.from(links).filter((l) => l.getAttribute("href") === "/dashboard");
    // At least one dashboard link should have active styling
    const hasActive = dashboardLinks.some((l) => l.className.includes("bg-cf-orange/10"));
    expect(hasActive).toBe(true);
  });
});

describe("MobileNav", () => {
  it("renders without crashing", () => {
    const { container } = render(<MobileNav />);
    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
  });

  it("renders bottom nav items with labels", () => {
    render(<MobileNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Emails")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders links for bottom nav items", () => {
    render(<MobileNav />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/emails");
    expect(hrefs).toContain("/customers");
    expect(hrefs).toContain("/settings");
  });

  it("has fixed positioning for bottom nav", () => {
    const { container } = render(<MobileNav />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("fixed");
    expect(nav?.className).toContain("bottom-0");
  });

  it("highlights active item", () => {
    render(<MobileNav />);
    const links = screen.getAllByRole("link");
    const homeLink = links.find((l) => l.getAttribute("href") === "/dashboard");
    expect(homeLink?.className).toContain("text-cf-orange");
  });
});
