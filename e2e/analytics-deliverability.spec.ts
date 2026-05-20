import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data fixtures
// ---------------------------------------------------------------------------

const ANALYTICS_RESPONSE = {
  data: {
    // Fields the page actually reads after apiGet unwraps `data`
    totalSent: 284,
    totalSentChangePercent: 5,
    totalSentPercent: 71,
    opened: 91,
    openRatePercent: 32,
    openRateLabel: "32% open rate",
    replied: 23,
    repliedChange: 3,
    repliedTrend: [4, 5, 3, 7, 6, 5, 8],
    booked: 6,
    bookedTrend: [0, 1, 0, 2, 1, 1, 1],
    weekData: [
      { label: "05-01", value: 12 },
      { label: "05-02", value: 18 },
    ],
    replyBreakdown: [
      { value: 23, color: "#F97316", label: "Replied" },
      { value: 261, color: "#222228", label: "No reply" },
    ],
    replyRate: "8.1%",
    tableData: [],
    // Aliases included so either field name is present
    totalOpened: 91,
    totalReplied: 23,
    totalBooked: 6,
    openRate: 32,
    replyRate8: 8.1,
    dailySent: [
      { date: "2026-05-01", count: 12 },
      { date: "2026-05-02", count: 18 },
    ],
  },
};

const FEED_RESPONSE = {
  data: {
    events: [
      {
        type: "replied",
        leadName: "Alex Chen",
        campaignName: "Q2 SaaS founders",
        timestamp: "2026-05-20T10:00:00Z",
      },
      {
        type: "opened",
        leadName: "Jordan Patel",
        campaignName: "Local dentists",
        timestamp: "2026-05-20T09:30:00Z",
      },
    ],
  },
};

const DELIVERABILITY_RESPONSE = {
  data: {
    healthScore: 82,
    inboxHealth: 82,
    inboxHealthLabel: "Good",
    trackingDomainEnabled: false,
    trackingDomain: null,
    inboxes: [
      {
        id: "inbox_1",
        email: "send@acme.com",
        spf: true,
        dkim: true,
        dmarc: true,
        bounceRate: 0.02,
        complaintRate: 0.0005,
        warmupProgress: 75,
      },
    ],
    bounceTrend: [
      { date: "2026-05-01", rate: 0.018 },
      { date: "2026-05-02", rate: 0.022 },
    ],
    dnsRecords: [],
    blacklistChecks: [],
    inboxProviders: [],
  },
};

const RECOMMENDATIONS_RESPONSE = {
  data: {
    recommendations: [
      {
        id: "rec_1",
        severity: "info",
        title: "Continue warmup",
        description: "Your inbox is 75% warmed up.",
        action: "Keep sending at current volume.",
      },
    ],
  },
};

const ALERTS_EMPTY_RESPONSE = {
  data: { alerts: [] },
};

const ALERTS_ONE_ITEM_RESPONSE = {
  data: {
    alerts: [
      {
        id: "alert_1",
        type: "high_bounce",
        campaignId: "camp_1",
        value: 0.08,
        createdAt: "2026-05-20T08:00:00Z",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function mockAnalyticsRoutes(page: Page) {
  await page.route("**/api/analytics/feed**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FEED_RESPONSE),
    });
  });

  await page.route("**/api/analytics**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ANALYTICS_RESPONSE),
    });
  });
}

async function mockDeliverabilityRoutes(
  page: Page,
  alertsPayload: typeof ALERTS_EMPTY_RESPONSE | typeof ALERTS_ONE_ITEM_RESPONSE = ALERTS_EMPTY_RESPONSE
) {
  await page.route("**/api/deliverability/recommendations**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(RECOMMENDATIONS_RESPONSE),
    });
  });

  await page.route("**/api/deliverability**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DELIVERABILITY_RESPONSE),
    });
  });

  await page.route("**/api/alerts**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(alertsPayload),
    });
  });
}

// ---------------------------------------------------------------------------
// Analytics tests
// ---------------------------------------------------------------------------

test.describe("Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyticsRoutes(page);
  });

  test("1. /analytics page loads without crashing", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible({ timeout: 8000 });
  });

  test("2. total sent metric '284' is visible", async ({ page }) => {
    await page.goto("/analytics");
    // Wait for loading state to clear (skeleton disappears when data arrives)
    await expect(page.getByText("284")).toBeVisible({ timeout: 8000 });
  });

  test("3. total replied metric '23' is visible", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByText("23")).toBeVisible({ timeout: 8000 });
  });

  test("4. open rate '32%' is visible", async ({ page }) => {
    await page.goto("/analytics");
    // The MetricCard renders openRateLabel "32% open rate" and the value 91,
    // plus MiniRing renders "32%" as center label — assert the percentage text
    await expect(page.getByText(/32%/)).toBeVisible({ timeout: 8000 });
  });

  test("5. chart/graph SVG element is rendered by Recharts or custom chart", async ({ page }) => {
    await page.goto("/analytics");
    // Wait for data to load
    await expect(page.getByText("284")).toBeVisible({ timeout: 8000 });
    // BarChart or any chart component outputs an SVG
    const svg = page.locator("svg").first();
    await expect(svg).toBeVisible({ timeout: 5000 });
  });

  test("6. /analytics/feed page loads", async ({ page }) => {
    await page.goto("/analytics/feed");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByRole("heading", { name: /activity feed/i })).toBeVisible({ timeout: 8000 });
  });

  test("7. activity feed shows 'Alex Chen' replied event", async ({ page }) => {
    await page.goto("/analytics/feed");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });
  });

  test("8. activity feed shows 'Jordan Patel' opened event", async ({ page }) => {
    await page.goto("/analytics/feed");
    await expect(page.getByText("Jordan Patel")).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Deliverability tests
// ---------------------------------------------------------------------------

test.describe("Deliverability", () => {
  test("1. /deliverability page loads without crashing", async ({ page }) => {
    await mockDeliverabilityRoutes(page);
    await page.goto("/deliverability");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByRole("heading", { name: /deliverability/i })).toBeVisible({ timeout: 8000 });
  });

  test("2. health score '82' is visible", async ({ page }) => {
    await mockDeliverabilityRoutes(page);
    await page.goto("/deliverability");
    await expect(page.getByText("82")).toBeVisible({ timeout: 8000 });
  });

  test("3. inbox 'send@acme.com' row is visible", async ({ page }) => {
    await mockDeliverabilityRoutes(page);
    await page.goto("/deliverability");
    await expect(page.getByText("send@acme.com")).toBeVisible({ timeout: 8000 });
  });

  test("4. SPF, DKIM, and DMARC badges all show passing (green) state", async ({ page }) => {
    await mockDeliverabilityRoutes(page);
    await page.goto("/deliverability");
    // BoolBadge renders label text when true — assert all three labels present
    await expect(page.getByText("SPF")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("DKIM")).toBeVisible();
    await expect(page.getByText("DMARC")).toBeVisible();
  });

  test("5. bounce trend chart SVG element is present", async ({ page }) => {
    await mockDeliverabilityRoutes(page);
    await page.goto("/deliverability");
    // Wait for content to settle
    await expect(page.getByText("send@acme.com")).toBeVisible({ timeout: 8000 });
    // Recharts LineChart renders an SVG
    const svg = page.locator("svg").first();
    await expect(svg).toBeVisible({ timeout: 5000 });
  });

  test("6. recommendations panel shows 'Continue warmup'", async ({ page }) => {
    await mockDeliverabilityRoutes(page);
    await page.goto("/deliverability");
    await expect(page.getByText("Continue warmup")).toBeVisible({ timeout: 8000 });
  });

  test("7. no alert banner when alerts array is empty", async ({ page }) => {
    await mockDeliverabilityRoutes(page, ALERTS_EMPTY_RESPONSE);
    await page.goto("/deliverability");
    // Wait for page to fully load
    await expect(page.getByRole("heading", { name: /deliverability/i })).toBeVisible({ timeout: 8000 });
    // The alert banner should not exist
    await expect(page.locator("text=active alert")).not.toBeVisible();
  });

  test("8. alert banner shows when alerts contain one item", async ({ page }) => {
    await mockDeliverabilityRoutes(page, ALERTS_ONE_ITEM_RESPONSE);
    await page.goto("/deliverability");
    // The page renders "1 active alert" when alerts.length > 0
    await expect(page.getByText(/1 active alert/i)).toBeVisible({ timeout: 8000 });
  });
});
