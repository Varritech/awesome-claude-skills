import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Guards E2E tests.
 *
 * Strategy: same mock helpers as onboarding.spec.ts.
 * All tests run as authenticated user via mockClerkSignedIn.
 * API routes are intercepted so no real server is needed for fixture-driven assertions.
 */

// ---------------------------------------------------------------------------
// Helpers (mirrored from onboarding.spec.ts)
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
  overrides: { onboardingComplete?: boolean } = {}
) {
  const onboardingComplete =
    overrides.onboardingComplete !== undefined ? overrides.onboardingComplete : true;

  await page.route("**/api/user/profile**", async (route: Route) => {
    if (route.request().method() === "GET") {
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
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "user_fake123" } }),
      });
    }
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
          repliesPercent: 25,
          interested: 1,
          interestedNew: 1,
          interestedTrend: [0, 1, 0, 1, 2, 1, 1],
          calls: 0,
          callsTrend: [0, 0, 0, 0, 0, 0, 0],
          weekData: [],
          campaigns: [],
          inboxHealth: 80,
          inboxHealthLabel: "Good",
          sendCompletionPercent: 24,
          recentReplies: [],
        },
      }),
    });
  });

  await page.route("**/api/domains**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route("**/api/inboxes**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route("**/api/personas**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          builtIns: [
            { id: "closer", name: "The Closer", description: "Direct and confident.", tone: "direct" },
            { id: "neighbor", name: "The Neighbor", description: "Friendly and warm.", tone: "warm" },
            { id: "expert", name: "The Expert", description: "Professional.", tone: "expert" },
            { id: "helper", name: "The Helper", description: "Helpful and genuine.", tone: "friendly" },
          ],
          custom: [],
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Setup banner tests
// ---------------------------------------------------------------------------

test.describe("Guards — Setup banner", () => {
  test("dashboard shows setup banner when onboardingComplete is false", async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: false });

    await page.goto("/dashboard");

    // Wait for the dashboard to finish loading (skeletons gone)
    await expect(page.getByText(/complete your setup/i)).toBeVisible({ timeout: 10000 });
    // The "Finish Setup" link should be present
    await expect(page.getByRole("link", { name: /finish setup/i })).toBeVisible();
  });

  test("dashboard does NOT show setup banner when onboardingComplete is true", async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: true });

    await page.goto("/dashboard");

    // Wait for content to load
    await expect(page.getByText(/hey there/i)).toBeVisible({ timeout: 10000 });
    // Setup banner must not appear
    await expect(page.getByText(/complete your setup/i)).not.toBeVisible();
    await expect(page.getByRole("link", { name: /finish setup/i })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Action card navigation tests
// ---------------------------------------------------------------------------

test.describe("Guards — Dashboard action cards navigate correctly", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: true });
  });

  test('action card "Send New Emails" navigates to /emails', async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/hey there/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: /send new emails/i }).click();
    await expect(page).toHaveURL(/\/emails/, { timeout: 6000 });
  });

  test('action card "Find Customers" navigates to /customers', async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/hey there/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: /find customers/i }).click();
    await expect(page).toHaveURL(/\/customers/, { timeout: 6000 });
  });

  test('action card "Email Styles" navigates to /styles', async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/hey there/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole("link", { name: /email styles/i }).click();
    await expect(page).toHaveURL(/\/styles/, { timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// 404 test
// ---------------------------------------------------------------------------

test.describe("Guards — 404 handling", () => {
  test("navigating to /nonexistent-route-xyz returns 404 status or shows error UI", async ({
    page,
  }) => {
    const response = await page.goto("/nonexistent-route-xyz");
    const status = response?.status();
    // Either a proper 404 HTTP status, or Next.js renders a not-found page in the UI
    const is404 = status === 404;
    const hasNotFoundUI =
      (await page
        .getByText(/404|not found|page not found|this page could not be found/i)
        .count()) > 0;
    expect(is404 || hasNotFoundUI).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Nav link presence tests
// ---------------------------------------------------------------------------

test.describe("Guards — Sidebar nav links present on dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page, { onboardingComplete: true });
    await page.goto("/dashboard");
    // Wait for page to fully hydrate before checking nav
    await expect(page.getByText(/hey there/i)).toBeVisible({ timeout: 10000 });
  });

  test("sidebar contains link to Dashboard (/dashboard)", async ({ page }) => {
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
  });

  test("sidebar contains link to Customers (/customers)", async ({ page }) => {
    await expect(page.locator('a[href="/customers"]').first()).toBeVisible();
  });

  test("sidebar contains link to Emails (/emails)", async ({ page }) => {
    await expect(page.locator('a[href="/emails"]').first()).toBeVisible();
  });

  test("sidebar contains link to Styles (/styles)", async ({ page }) => {
    await expect(page.locator('a[href="/styles"]').first()).toBeVisible();
  });

  test("sidebar contains link to Deliverability (/deliverability)", async ({ page }) => {
    await expect(page.locator('a[href="/deliverability"]').first()).toBeVisible();
  });

  test("sidebar contains link to Analytics (/analytics)", async ({ page }) => {
    await expect(page.locator('a[href="/analytics"]').first()).toBeVisible();
  });

  test("sidebar contains link to Help (/help)", async ({ page }) => {
    await expect(page.locator('a[href="/help"]').first()).toBeVisible();
  });

  test("sidebar contains link to Settings (/settings)", async ({ page }) => {
    await expect(page.locator('a[href="/settings"]').first()).toBeVisible();
  });
});
