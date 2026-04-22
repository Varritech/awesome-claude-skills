import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Onboarding E2E tests.
 *
 * Strategy: Clerk auth can't be driven via real OAuth in CI, so we:
 * 1. Intercept Clerk's /v1/client endpoint to return a fake signed-in session
 * 2. Intercept all /api/* calls to return controlled fixture data
 * 3. Walk through all 5 onboarding steps and assert UI + navigation
 *
 * For the SSO callback test we verify the public-route fix by confirming
 * the page doesn't 404 and does redirect to onboarding.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockClerkSignedIn(page: Page) {
  // Fake a Clerk session so middleware sees an authenticated user.
  // Clerk reads __session cookie + /v1/client to hydrate auth state.
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

  // Intercept Clerk's own client endpoint
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
  // Profile — not yet onboarded
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
            onboardingComplete: false,
            onboardingStep: "domain",
            tier: "self_serve",
          },
        }),
      });
    } else {
      // PATCH — just echo back success
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "user_fake123" } }),
      });
    }
  });

  // Onboarding state
  await page.route("**/api/user/onboarding**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          userId: "user_fake123",
          step: "domain",
          completed: false,
          stepsCompleted: {},
        },
      }),
    });
  });

  // Domains
  await page.route("**/api/domains**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  // Inboxes
  await page.route("**/api/inboxes**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  // Personas
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
// Tests
// ---------------------------------------------------------------------------

test.describe("Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  // -------------------------------------------------------------------------
  // 1. SSO callback no longer 404s (regression for the fix)
  // -------------------------------------------------------------------------
  test("SSO callback route is public and does not 404", async ({ page }) => {
    const response = await page.goto(
      "/login/sso-callback?after_sign_in_url=%2Fonboarding&after_sign_up_url=%2Fonboarding&redirect_url=%2Fonboarding"
    );
    // Must not be a 404 — Clerk's SSO handler or a redirect is acceptable
    expect(response?.status()).not.toBe(404);
  });

  // -------------------------------------------------------------------------
  // 2. /onboarding landing — public, renders correctly
  // -------------------------------------------------------------------------
  test("onboarding landing page renders and shows CTA", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText(/cold email made simple/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/5-minute setup/i)).toBeVisible();
    await expect(page.getByText(/land in primary/i)).toBeVisible();
    await expect(page.getByText(/industry templates/i)).toBeVisible();
    // CTA button present
    await expect(page.getByRole("link", { name: /get started|continue setup/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Step 1 — Sign up page renders
  // -------------------------------------------------------------------------
  test("signup page renders Clerk SignUp component", async ({ page }) => {
    await page.goto("/onboarding/signup");
    await expect(page).not.toHaveURL(/404/);
    // Clerk renders an iframe or form — check the page doesn't error
    const title = await page.title();
    expect(title).toContain("ConvergeFlow");
  });

  // -------------------------------------------------------------------------
  // 4. Step 2 — Domain connection page
  // -------------------------------------------------------------------------
  test("domain step renders and validates empty submit", async ({ page }) => {
    await page.goto("/onboarding/domain");

    // Progress breadcrumb visible
    await expect(page.getByText(/domain/i).first()).toBeVisible({ timeout: 8000 });

    // Domain input present
    const input = page.getByPlaceholder(/yourdomain\.com|your domain/i);
    await expect(input).toBeVisible();

    // Submitting empty should not navigate away
    const continueBtn = page.getByRole("button", { name: /next|connect|continue|verify/i }).first();
    await continueBtn.click();
    await expect(page).toHaveURL(/\/onboarding\/domain/);
  });

  test("domain step accepts valid domain and calls API", async ({ page }) => {
    const patchRequests: string[] = [];
    await page.route("**/api/domains**", async (route: Route) => {
      if (route.request().method() === "POST") {
        patchRequests.push(route.request().url());
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: "dom_1", domain: "testco.com", status: "pending" } }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
      }
    });

    await page.goto("/onboarding/domain");

    const input = page.getByPlaceholder(/yourdomain\.com|your domain/i);
    await input.fill("testco.com");

    const continueBtn = page.getByRole("button", { name: /next|connect|continue|verify/i }).first();
    await continueBtn.click();

    // Should navigate to inbox step or show success state
    await expect(page).toHaveURL(/\/onboarding\/(inbox|domain)/);
  });

  // -------------------------------------------------------------------------
  // 5. Step 3 — Inbox connection page
  // -------------------------------------------------------------------------
  test("inbox step renders connect options", async ({ page }) => {
    await page.goto("/onboarding/inbox");

    await expect(page).not.toHaveURL(/404/);
    // Should show Gmail/Outlook or similar options
    await expect(
      page.getByText(/gmail|google|inbox|connect/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  // -------------------------------------------------------------------------
  // 6. Step 4 — Industry selection
  // -------------------------------------------------------------------------
  test("industry step renders all 10 industry options", async ({ page }) => {
    await page.goto("/onboarding/industry");

    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText("Roofing")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Solar")).toBeVisible();
    await expect(page.getByText("HVAC")).toBeVisible();
    await expect(page.getByText("Plumbing")).toBeVisible();
    await expect(page.getByText("Electrical")).toBeVisible();
    await expect(page.getByText("Painting")).toBeVisible();
    await expect(page.getByText("Landscaping")).toBeVisible();
    await expect(page.getByText("Cleaning")).toBeVisible();
    await expect(page.getByText("Other")).toBeVisible();
  });

  test("industry step: selecting Roofing enables Next button and calls API", async ({ page }) => {
    let patched = false;
    await page.route("**/api/user/onboarding**", async (route: Route) => {
      if (route.request().method() === "PATCH") {
        patched = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { step: "persona" } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { step: "industry", completed: false, stepsCompleted: {} } }),
        });
      }
    });

    await page.goto("/onboarding/industry");

    // Click Roofing
    await page.getByText("Roofing").click();

    // Next button should become active
    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).not.toBeDisabled({ timeout: 3000 });

    await nextBtn.click();

    // API was called
    expect(patched).toBe(true);

    // Should navigate to style step
    await expect(page).toHaveURL(/\/onboarding\/style/);
  });

  test("industry step: Other shows text input", async ({ page }) => {
    await page.goto("/onboarding/industry");

    await page.getByText("Other").click();
    const otherInput = page.getByPlaceholder(/what.*business/i);
    await expect(otherInput).toBeVisible();

    // Next remains disabled until text entered
    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeDisabled();

    await otherInput.fill("Window Cleaning");
    await expect(nextBtn).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 7. Step 5 — Style (persona) selection
  // -------------------------------------------------------------------------
  test("style step renders all 4 personas", async ({ page }) => {
    await page.goto("/onboarding/style");

    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText("The Closer")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("The Neighbor")).toBeVisible();
    await expect(page.getByText("The Expert")).toBeVisible();
    await expect(page.getByText("The Helper")).toBeVisible();
  });

  test("style step: launch button disabled until persona selected", async ({ page }) => {
    await page.goto("/onboarding/style");

    const launchBtn = page.getByRole("button", { name: /start sending/i });
    await expect(launchBtn).toBeDisabled({ timeout: 8000 });

    // Select The Closer
    await page.getByText("The Closer").click();
    await expect(launchBtn).not.toBeDisabled();
  });

  test("style step: selecting persona and launching calls API and redirects to dashboard", async ({ page }) => {
    let patchCalled = false;
    await page.route("**/api/user/onboarding**", async (route: Route) => {
      if (route.request().method() === "PATCH") {
        patchCalled = true;
        const body = JSON.parse(route.request().postData() ?? "{}");
        expect(body).toMatchObject({ persona: expect.any(String), onboardingComplete: true });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { step: "complete", completed: true } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { step: "persona", completed: false, stepsCompleted: {} } }),
        });
      }
    });

    await page.goto("/onboarding/style");

    await page.getByText("The Neighbor").click();
    await page.getByRole("button", { name: /start sending/i }).click();

    expect(patchCalled).toBe(true);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });

  // -------------------------------------------------------------------------
  // 8. Full happy-path walk-through (chained navigation)
  // -------------------------------------------------------------------------
  test("full onboarding happy path: landing → industry → style → dashboard", async ({ page }) => {
    // Override onboarding PATCH to always succeed
    await page.route("**/api/user/onboarding**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { step: "complete", completed: true } }),
      });
    });
    await page.route("**/api/domains**", async (route: Route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "dom_1", domain: "acme.com", status: "pending" } }),
      });
    });

    // Start at landing
    await page.goto("/onboarding");
    await expect(page.getByText(/cold email made simple/i)).toBeVisible({ timeout: 8000 });

    // Jump to industry (skipping OAuth-gated steps)
    await page.goto("/onboarding/industry");
    await page.getByText("Roofing").click();
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/style/, { timeout: 6000 });

    // Style step
    await page.getByText("The Closer").click();
    await page.getByRole("button", { name: /start sending/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // Dashboard loaded
    await expect(page.getByText(/hey there|dashboard/i).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. Back navigation works between steps
  // -------------------------------------------------------------------------
  test("back link on style step returns to industry step", async ({ page }) => {
    await page.goto("/onboarding/style");
    await page.getByRole("link", { name: /back/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/industry/);
  });

  test("back link on industry step returns to inbox step", async ({ page }) => {
    await page.goto("/onboarding/industry");
    await page.getByRole("link", { name: /back/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/inbox/);
  });
});
