import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Mobile E2E tests — iPhone 15 viewport (390×844).
 *
 * Tests that key pages load correctly at a mobile viewport and that the
 * MobileNav bottom bar is present and functional.
 */

test.use({ viewport: { width: 390, height: 844 } });

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

async function mockApiRoutes(page: Page) {
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
          onboardingComplete: true,
          onboardingStep: null,
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
          step: "complete",
          completed: true,
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
          sent: 5,
          dailyLimit: 50,
          sentPercent: 10,
          replies: 1,
          repliesChangePercent: 0,
          repliesPercent: 2,
          interested: 0,
          interestedNew: 0,
          interestedTrend: [0, 0, 0, 0, 0, 0, 0],
          calls: 0,
          callsTrend: [0, 0, 0, 0, 0, 0, 0],
          weekData: [],
          campaigns: [],
          inboxHealth: 80,
          inboxHealthLabel: "Good",
          sendCompletionPercent: 10,
          recentReplies: [],
        },
      }),
    });
  });

  await page.route("**/api/leads**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { leads: [], industries: [] } }),
    });
  });

  await page.route("**/api/emails**", async (route: Route) => {
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
      body: JSON.stringify({ data: { builtIns: [], custom: [] } }),
    });
  });

  await page.route("**/api/domains**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Mobile viewport (390×844 — iPhone 15)", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  test("dashboard loads on mobile viewport", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Hey there/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Emails Sent")).toBeVisible();
    await expect(page.getByText("Replies")).toBeVisible();
  });

  test("mobile bottom nav bar is present on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // MobileNav is a <nav> with md:hidden — visible only at mobile widths
    const mobileNav = page.locator("nav").filter({ has: page.locator('a[href="/dashboard"]') }).last();
    await expect(mobileNav).toBeVisible({ timeout: 8000 });
    // The bottom nav shows Home, Emails, Customers, Account
    await expect(page.getByText("Home").last()).toBeVisible();
    await expect(page.getByText("Emails").last()).toBeVisible();
    await expect(page.getByText("Customers").last()).toBeVisible();
    await expect(page.getByText("Account").last()).toBeVisible();
  });

  test("/customers loads on mobile", async ({ page }) => {
    await page.goto("/customers");
    await expect(page).not.toHaveURL(/\/error|\/404/);
    await expect(page.locator("body")).not.toBeEmpty();
    // Page heading or content present
    await expect(page.locator("h1, h2, [class*='heading']").first()).toBeVisible({ timeout: 10000 });
  });

  test("/emails loads on mobile", async ({ page }) => {
    await page.goto("/emails");
    await expect(page).not.toHaveURL(/\/error|\/404/);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator("h1, h2, [class*='heading']").first()).toBeVisible({ timeout: 10000 });
  });

  test("/help loads on mobile and FAQ accordion is interactive", async ({ page }) => {
    await page.goto("/help");
    await expect(page).not.toHaveURL(/\/error|\/404/);
    await expect(page.getByText("Need Help?")).toBeVisible({ timeout: 8000 });

    // The first FAQ item should be open by default (openFaq state initialised to 0)
    const firstQuestion = page.getByText("How do I connect my email inbox?");
    await expect(firstQuestion).toBeVisible();

    // Click a different FAQ item to confirm the accordion toggles
    const secondQuestion = page.getByText("Can I customize the email templates?");
    await secondQuestion.click();
    await expect(
      page.getByText(/Email Styles to choose from our 4 writing personas/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("/onboarding/industry renders correctly on mobile", async ({ page }) => {
    // Override onboarding to return not-completed so guard doesn't redirect
    await page.route("**/api/user/onboarding**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            userId: "user_fake123",
            step: "industry",
            completed: false,
            stepsCompleted: {},
          },
        }),
      });
    });

    await page.goto("/onboarding/industry");
    await expect(page).not.toHaveURL(/\/error|\/404/);
    // Industry options must render on small screen
    await expect(page.getByText("Roofing")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Solar")).toBeVisible();
    await expect(page.getByText("HVAC")).toBeVisible();
    await expect(page.getByText("Other")).toBeVisible();
    // Next button present (disabled until selection)
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  });
});
