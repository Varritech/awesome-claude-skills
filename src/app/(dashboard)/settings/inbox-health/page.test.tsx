import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from "@/lib/api-client";
import InboxHealthPage from "./page";

const warmingInbox = {
  id: "ib_1",
  email: "christian@christianvarriale.com",
  provider: "gmail",
  status: "warming",
  warmupEnabled: true,
  warmupStartDate: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  warmupSentTotal: 3,
  recentWarmupSends: [
    { to: "warmup1@varritechlabs.com", subject: "Checking in", sentAt: new Date().toISOString() },
  ],
  warmupProgressPercent: 14,
  dailyQuotaUsed: 0,
  dailyQuotaTotal: 11,
  bounceRate: 0,
  statusBadge: "warming" as const,
};

const healthyInbox = {
  ...warmingInbox,
  id: "ib_2",
  status: "active",
  warmupProgressPercent: 100,
  dailyQuotaTotal: 50,
  statusBadge: "healthy" as const,
};

beforeEach(() => {
  (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([]);
});

describe("InboxHealthPage — warming banner", () => {
  it("shows the warming banner for a warming inbox", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([
      warmingInbox,
    ]);
    render(<InboxHealthPage />);

    expect(await screen.findByText("This mailbox is being warmed.")).toBeInTheDocument();
    expect(
      screen.getByText(/Check back in 14 days to see if this is happening./),
    ).toBeInTheDocument();
    // Day-of-14 label is rendered from warmupStartDate
    expect(screen.getByText(/Day \d+ of 14/)).toBeInTheDocument();
    // Warmup visibility: counter + recent log entry
    expect(screen.getByText(/Warmup emails sent:/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/warmup1@varritechlabs.com/)).toBeInTheDocument();
  });

  it("does not show the warming banner for a healthy/active inbox", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue([
      healthyInbox,
    ]);
    render(<InboxHealthPage />);

    await screen.findByText("christian@christianvarriale.com");
    expect(screen.queryByText("This mailbox is being warmed.")).not.toBeInTheDocument();
  });
});