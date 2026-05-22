import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Dashboard Extended E2E tests.
 *
 * Covers what dashboard.spec.ts misses:
 * - Sidebar nav link presence and navigation
 * - Setup banner conditional rendering
 * - NotificationBell / FeedbackWidget placeholders (noted as not-yet-implemented)
 * - API error and network-abort resilience
 *
 * Strategy: same mockClerkSignedIn + route-intercept approach as other specs.
 * Profile mock returns onboardingComplete:true by default so OnboardingGuard
 * does not redirect away from /dashboard.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockClerkSignedIn(page: Page) {
  await page.context().addCookies([
    {
      name: "__session",
      value: "fake-session-token",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
    },
  ]);

  await page.route("**/v1/client**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: {
          sessions: [
            {
              id: "sess_fake",
              status: "active",
              user: {
                id: "user_fake123",
                email_addresses: [{ email_address: "test@example.com" }],
                first_name: "Test",
                last_name: "User",
              },
            },
          ],
          client: { sessions: [] },
        },
      }),
    });
  });
}

async function mockApiRoutes(
  page: Page,
  opts: {
    onboardingComplete?: boolean;
    onboardingSkipped?: boolean;
  } = {}
) {
  const onboardingComplete = opts.onboardingComplete ?? true;
  const onboardingSkipped = opts.onboardingSkipped ?? false;

  await page.route("**/api/user/profile**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "user_fake123",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          onboardingComplete,
          onboardingStep: onboardingComplete ? null : "domain",
          tier: "self_serve",
        },
      }),
    });
  });

  await page.route("**/api/user/onboarding**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          userId: "user_fake123",
          step: onboardingComplete ? "complete" : "domain",
          completed: onboardingComplete,
          onboardingSkipped,
          stepsCompleted: {},
        },
      }),
    });
  });

  await page.route("**/api/analytics**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          sent: 12,
          dailyLimit: 50,
          sentPercent: 24,
          replies: 3,
          repliesChangePercent: 10,
          repliesPercent: 6,
          interested: 1,
          interestedNew: 1,
          interestedTrend: [0, 1, 0, 1, 2, 1, 1],
          calls: 0,
          callsTrend: [0, 0, 0, 0, 0, 0, 0],
          weekData: [
            { label: "Mon", value: 8 },
            { label: "Tue", value: 12, isHighlighted: true },
          ],
          campaigns: [
            { name: "Roofing Campaign", status: "active" },
            { name: "Solar Draft", status: "draft" },
          ],
          inboxHealth: 88,
          inboxHealthLabel: "Good",
          sendCompletionPercent: 24,
          recentReplies: [],
        },
      }),
    });
  });

  await page.route("**/api/campaigns**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "c1", name: "Roofing Campaign", status: "active" },
          { id: "c2", name: "Solar Draft", status: "draft" },
        ],
      }),
    });
  });

  await page.route("**/api/leads**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          leads: [
            { id: "l1", name: "Acme Corp", company: "Acme", industry: "Roofing", location: "Dallas TX", freshness: "new", score: 90 },
            { id: "l2", name: "Beta LLC", company: "Beta", industry: "Solar", location: "Austin TX", freshness: "warm", score: 75 },
          ],
          industries: ["Roofing", "Solar"],
        },
      }),
    });
  });

  await page.route("**/api/emails**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "e1", subject: "Quick question about your roof", status: "sent", campaignId: "c1" },
        ],
      }),
    });
  });

  await page.route("**/api/inboxes**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "i1", email: "outreach@testco.com", provider: "gmail", status: "active" },
        ],
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Sidebar navigation tests
// ---------------------------------------------------------------------------

test.describe("Dashboard sidebar nav — links present", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  // The sidebar is icon-only on desktop (no visible text labels).
  // We verify each nav link exists by href attribute inside the <aside>.
  test("sidebar contains Dashboard link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/dashboard"]').first()).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Emails link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/emails"]')).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Customers link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/customers"]')).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Styles link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/styles"]')).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Analytics link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/analytics"]')).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Deliverability link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/deliverability"]')).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Help link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/help"]')).toBeVisible({ timeout: 8000 });
  });

  test("sidebar contains Settings link", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('a[href="/settings"]')).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Sidebar navigation — clicking navigates correctly
// ---------------------------------------------------------------------------

test.describe("Dashboard sidebar nav — navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
    // Stub all destination page API calls so they don't crash
    await page.route("**/api/personas**", async (route: Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { builtIns: [], custom: [] } }) });
    });
    await page.route("**/api/domains**", async (route: Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
    });
  });

  test("clicking Customers nav link navigates to /customers", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/customers"]').click();
    await expect(page).toHaveURL(/\/customers/, { timeout: 8000 });
  });

  test("clicking Emails nav link navigates to /emails", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/emails"]').click();
    await expect(page).toHaveURL(/\/emails/, { timeout: 8000 });
  });

  test("clicking Styles nav link navigates to /styles", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/styles"]').click();
    await expect(page).toHaveURL(/\/styles/, { timeout: 8000 });
  });

  test("clicking Deliverability nav link navigates to /deliverability", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/deliverability"]').click();
    await expect(page).toHaveURL(/\/deliverability/, { timeout: 8000 });
  });

  test("clicking Analytics nav link navigates to /analytics", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/analytics"]').click();
    await expect(page).toHaveURL(/\/analytics/, { timeout: 8000 });
  });

  test("clicking Help nav link navigates to /help", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/help"]').click();
    await expect(page).toHaveURL(/\/help/, { timeout: 8000 });
  });

  test("clicking Settings nav link navigates to /settings", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("aside");
    await sidebar.locator('a[href="/settings"]').click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// NotificationBell — not yet implemented in UI, tests document expected behaviour
// ---------------------------------------------------------------------------

test.describe("NotificationBell (UI not yet implemented — placeholder tests)", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  test("TODO: NotificationBell component should render in header (bell icon)", async ({ page }) => {
    // NotificationBell is not yet present in DashboardLayout.
    // This test is intentionally skipped until the component ships.
    test.skip(true, "NotificationBell component not yet implemented in DashboardLayout");
    await page.goto("/dashboard");
    const bell = page.locator('[data-testid="notification-bell"], [aria-label*="notification" i], button[aria-label*="bell" i]');
    await expect(bell).toBeVisible({ timeout: 8000 });
  });

  test("TODO: clicking NotificationBell opens dropdown", async ({ page }) => {
    test.skip(true, "NotificationBell component not yet implemented in DashboardLayout");
    await page.route("**/api/notifications**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { notifications: [] } }),
      });
    });
    await page.goto("/dashboard");
    await page.locator('[aria-label*="notification" i]').click();
    await expect(page.locator('[role="menu"], [data-testid="notification-dropdown"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// FeedbackWidget — not yet implemented in UI, tests document expected behaviour
// ---------------------------------------------------------------------------

test.describe("FeedbackWidget (UI not yet implemented — placeholder tests)", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  test("TODO: FeedbackWidget floating button should render bottom-right", async ({ page }) => {
    test.skip(true, "FeedbackWidget component not yet implemented in DashboardLayout");
    await page.goto("/dashboard");
    const widget = page.locator('[data-testid="feedback-widget"], [aria-label*="feedback" i]');
    await expect(widget).toBeVisible({ timeout: 8000 });
  });

  test("TODO: clicking FeedbackWidget opens modal with type selector and textarea", async ({ page }) => {
    test.skip(true, "FeedbackWidget component not yet implemented in DashboardLayout");
    await page.goto("/dashboard");
    await page.locator('[data-testid="feedback-widget"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test("TODO: submitting FeedbackWidget calls POST /api/feedback", async ({ page }) => {
    test.skip(true, "FeedbackWidget component not yet implemented in DashboardLayout");
    let posted = false;
    await page.route("**/api/feedback**", async (route: Route) => {
      if (route.request().method() === "POST") {
        posted = true;
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { id: "fb_1" } }) });
      } else {
        await route.continue();
      }
    });
    await page.goto("/dashboard");
    await page.locator('[data-testid="feedback-widget"]').click();
    await page.locator('textarea').fill("Great product!");
    await page.getByRole("button", { name: /submit/i }).click();
    expect(posted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Setup banner conditional rendering
// ---------------------------------------------------------------------------

test.describe("Dashboard setup banner", () => {
  test("shows setup banner when onboardingComplete:false and onboardingSkipped:false", async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: false, onboardingSkipped: false });
    await page.goto("/dashboard");

    // Wait for the async onboarding check to resolve
    await expect(
      page.getByText(/complete your setup/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: /finish setup/i })
    ).toBeVisible();
  });

  test("setup banner NOT shown when onboardingComplete:true", async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: true, onboardingSkipped: false });
    await page.goto("/dashboard");

    // Wait for the page to load fully before asserting absence
    await expect(page.getByText(/Hey there/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/complete your setup/i)).not.toBeVisible();
  });

  test("setup banner NOT shown when onboardingSkipped:true", async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: false, onboardingSkipped: true });
    await page.goto("/dashboard");

    await expect(page.getByText(/Hey there/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/complete your setup/i)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// API error resilience
// ---------------------------------------------------------------------------

test.describe("Dashboard API error resilience", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
  });

  test("dashboard renders gracefully when /api/analytics returns 500", async ({ page }) => {
    // Mock onboarding and profile as normal
    await page.route("**/api/user/profile**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "user_fake123", onboardingComplete: true, tier: "self_serve" } }),
      });
    });
    await page.route("**/api/user/onboarding**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { completed: true, stepsCompleted: {} } }),
      });
    });
    // Analytics returns 500
    await page.route("**/api/analytics**", async (route: Route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal Server Error" }) });
    });

    // Page must not crash — heading should still render with fallback zeros
    await page.goto("/dashboard");
    await expect(page.getByText(/Hey there/i)).toBeVisible({ timeout: 10000 });
    // Metric cards render with fallback values (0)
    await expect(page.getByText("Emails Sent")).toBeVisible();
  });

  test("dashboard renders without crashing when /api/leads request is aborted", async ({ page }) => {
    await page.route("**/api/user/profile**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "user_fake123", onboardingComplete: true, tier: "self_serve" } }),
      });
    });
    await page.route("**/api/user/onboarding**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { completed: true, stepsCompleted: {} } }),
      });
    });
    await page.route("**/api/analytics**", async (route: Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });
    // Abort the leads request to simulate offline/network failure
    await page.route("**/api/leads**", async (route: Route) => {
      await route.abort("failed");
    });

    await page.goto("/dashboard");
    // The dashboard page itself does not call /api/leads — customers page does.
    // Navigate to customers and verify no hard crash.
    await page.goto("/customers");
    // Page must render without a fatal error — either shows empty state or error message
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page).not.toHaveURL(/\/error|\/500/);
  });
});
