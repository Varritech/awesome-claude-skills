import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Customers / Leads page E2E tests.
 *
 * Strategy:
 * 1. Intercept Clerk's /v1/client endpoint to return a fake signed-in session
 * 2. Intercept /api/user/profile to return onboardingComplete: true
 * 3. Intercept /api/leads (and /api/leads/search) to return controlled fixture data
 * 4. Assert the customers page renders correctly and user interactions work
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LEADS_FIXTURE = {
  data: {
    leads: [
      {
        id: "ld_1",
        name: "Alex Chen",
        company: "Acme SaaS",
        industry: "SaaS",
        location: "New York, NY",
        freshness: "new",
        score: 87,
      },
      {
        id: "ld_2",
        name: "Jordan Patel",
        company: "Northside Dental",
        industry: "Healthcare",
        location: "Austin, TX",
        freshness: "warm",
        score: 72,
      },
    ],
    industries: ["SaaS", "Healthcare"],
  },
};

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

async function mockDashboardApis(page: Page) {
  // Profile — onboarding complete
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
            onboardingComplete: true,
            onboardingStep: "complete",
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

  // Campaigns
  await page.route("**/api/campaigns**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  // Leads — default fixture
  await page.route("**/api/leads**", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(LEADS_FIXTURE),
      });
    } else if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            imported: 1,
            source: "manual",
            leads: [
              {
                id: "ld_new_1",
                name: "New Lead",
                company: "New Co",
                industry: "SaaS",
                location: "Chicago, IL",
                freshness: "new",
                score: 75,
              },
            ],
          },
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
    }
  });

  // Leads search
  await page.route("**/api/leads/search**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          leads: [LEADS_FIXTURE.data.leads[0]],
          industries: ["SaaS"],
        },
      }),
    });
  });

  // Emails
  await page.route("**/api/emails**", async (route: Route) => {
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

  // Domains
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

test.describe("Customers / Leads page", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockDashboardApis(page);
  });

  // -------------------------------------------------------------------------
  // 1. Page loads and shows lead count or list
  // -------------------------------------------------------------------------
  test("loads /customers and shows the leads list", async ({ page }) => {
    await page.goto("/customers");

    await expect(page).not.toHaveURL(/404/);
    // The page heading
    await expect(page.getByText(/find customers/i)).toBeVisible({ timeout: 8000 });
    // At least one lead card rendered
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });
  });

  // -------------------------------------------------------------------------
  // 2. Both lead names are visible
  // -------------------------------------------------------------------------
  test("shows all leads returned by the API", async ({ page }) => {
    await page.goto("/customers");

    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Jordan Patel")).toBeVisible({ timeout: 8000 });
  });

  // -------------------------------------------------------------------------
  // 3. Industry filter chips show API-returned industries
  // -------------------------------------------------------------------------
  test("industry filter chips include SaaS and Healthcare", async ({ page }) => {
    await page.goto("/customers");

    // Wait for leads to render (means API responded and industries populated)
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    // Industry chips rendered from the API response
    await expect(page.getByRole("button", { name: "SaaS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Healthcare" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Selecting "SaaS" filter calls API with industry param
  // -------------------------------------------------------------------------
  test("clicking SaaS filter chip calls API with ?industry=SaaS", async ({ page }) => {
    const industryRequests: string[] = [];

    // Override leads route to capture calls with query params
    await page.route("**/api/leads**", async (route: Route) => {
      const url = route.request().url();
      if (route.request().method() === "GET") {
        industryRequests.push(url);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              leads: [LEADS_FIXTURE.data.leads[0]],
              industries: ["SaaS"],
            },
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
      }
    });

    await page.goto("/customers");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    // Click the SaaS chip
    await page.getByRole("button", { name: "SaaS" }).click();

    // Wait briefly for the debounced useEffect to fire
    await page.waitForTimeout(400);

    // Assert at least one request contained ?industry=SaaS
    const filtered = industryRequests.filter((u) => u.includes("industry=SaaS"));
    expect(filtered.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 5. Search input is present and typing triggers API call
  // -------------------------------------------------------------------------
  test("search input is present and typing triggers a search API call", async ({ page }) => {
    const searchRequests: string[] = [];

    await page.route("**/api/leads/search**", async (route: Route) => {
      searchRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            leads: [LEADS_FIXTURE.data.leads[0]],
            industries: ["SaaS"],
          },
        }),
      });
    });

    await page.goto("/customers");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    const searchInput = page.getByPlaceholder(/search by name/i);
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Alex");

    // Wait for the 250ms debounce + a bit of margin
    await page.waitForTimeout(400);

    // At least one search request fired
    expect(searchRequests.length).toBeGreaterThan(0);
    expect(searchRequests[0]).toContain("q=Alex");
  });

  // -------------------------------------------------------------------------
  // 6. Export CSV button appears after selecting a lead
  // -------------------------------------------------------------------------
  test("Export button is visible in action bar after selecting a lead", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    // Click Alex Chen's card to select it
    const alexCard = page.locator("text=Alex Chen").first();
    await alexCard.click();

    // Sticky action bar should appear with Export button
    await expect(page.getByRole("button", { name: /export/i })).toBeVisible({ timeout: 4000 });
  });

  // -------------------------------------------------------------------------
  // 7. Clicking a lead row selects it (toggle selection state)
  // -------------------------------------------------------------------------
  test("clicking a lead card selects it and shows the action bar", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByText("Jordan Patel")).toBeVisible({ timeout: 8000 });

    // Click Jordan Patel's card
    const jordanCard = page.locator("text=Jordan Patel").first();
    await jordanCard.click();

    // The sticky action bar shows the selection count
    await expect(page.getByText(/1 selected/i)).toBeVisible({ timeout: 4000 });
    // "Add to Campaign" button present in the action bar
    await expect(page.getByRole("button", { name: /add to campaign/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 8. "Add to Campaign" button is present after selecting a lead
  // -------------------------------------------------------------------------
  test("Add to Campaign button appears when at least one lead is selected", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    // Select a lead
    await page.locator("text=Alex Chen").first().click();

    await expect(page.getByRole("button", { name: /add to campaign/i })).toBeVisible({ timeout: 4000 });
  });

  // -------------------------------------------------------------------------
  // Bonus: Selecting multiple leads updates the count
  // -------------------------------------------------------------------------
  test("selecting both leads shows correct selection count", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    await page.locator("text=Alex Chen").first().click();
    await page.locator("text=Jordan Patel").first().click();

    await expect(page.getByText(/2 selected/i)).toBeVisible({ timeout: 4000 });
  });

  // -------------------------------------------------------------------------
  // Bonus: Clicking Add to Campaign opens the campaign modal
  // -------------------------------------------------------------------------
  test("clicking Add to Campaign opens the campaign modal", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByText("Alex Chen")).toBeVisible({ timeout: 8000 });

    await page.locator("text=Alex Chen").first().click();
    await page.getByRole("button", { name: /add to campaign/i }).click();

    // Modal content
    await expect(page.getByText(/add to campaign/i).nth(1)).toBeVisible({ timeout: 4000 });
    await expect(page.getByRole("link", { name: /go to emails/i })).toBeVisible();
  });
});
