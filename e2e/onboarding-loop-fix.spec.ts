import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Regression: returning users were being sent back through onboarding on every
 * login. Verifies that when a user has finished onboarding, hitting any
 * /onboarding route routes them straight to /dashboard instead of repeating
 * the flow, and that a not-yet-onboarded user is still routed into onboarding.
 */

async function mockClerkSignedIn(page: Page, onboardingCompleted: boolean) {
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
                id: "user_fake_loop",
                email_addresses: [{ email_address: "loop@example.com" }],
                first_name: "Loop",
                last_name: "User",
                public_metadata: { onboardingCompleted },
              },
            },
          ],
          client: { sessions: [] },
        },
      }),
    });
  });
}

async function mockProfileApi(page: Page, onboardingCompleted: boolean) {
  await page.route("**/api/user/profile**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "user_fake_loop",
          firstName: "Loop",
          lastName: "User",
          email: "loop@example.com",
          onboardingCompleted,
          onboardingStep: onboardingCompleted ? "complete" : "domain",
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
          userId: "user_fake_loop",
          step: onboardingCompleted ? "complete" : "domain",
          completed: onboardingCompleted,
          stepsCompleted: {},
        },
      }),
    });
  });
}

test.describe("Onboarding loop fix", () => {
  test("returning, onboarded user landing on /onboarding goes to /dashboard", async ({ page }) => {
    await mockClerkSignedIn(page, true);
    await mockProfileApi(page, true);

    await page.goto("/onboarding");
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test("onboarded user opening a deep onboarding step is also bounced to /dashboard", async ({ page }) => {
    await mockClerkSignedIn(page, true);
    await mockProfileApi(page, true);

    await page.goto("/onboarding/path");
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test("brand-new user hitting /onboarding is routed into /onboarding/path", async ({ page }) => {
    await mockClerkSignedIn(page, false);
    await mockProfileApi(page, false);

    await page.goto("/onboarding");
    await page.waitForURL(/\/onboarding\/path/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/onboarding\/path/);
  });
});
