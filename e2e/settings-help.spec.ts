import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers — mock authentication + API routes
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

/**
 * Mock all API routes needed by settings and help pages.
 *
 * Note: /settings loads profile data from /api/user/profile only — the
 * inboxes and domains are embedded in the profile response, not fetched
 * separately. /settings/inbox-health fetches /api/inboxes/health.
 */
async function mockApiRoutes(page: Page) {
  // User profile — includes embedded inboxes and domains
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
            fullName: "Test User",
            email: "test@example.com",
            onboardingComplete: true,
            tier: "self_serve",
            inboxes: [
              {
                id: "inbox_1",
                email: "send@acme.com",
                provider: "smtp",
                status: "connected",
              },
            ],
            domains: [
              {
                id: "dom_1",
                domain: "acme.com",
                status: "verified",
              },
            ],
            preferences: {
              emailNotifications: false,
              autoFollowUp: false,
              weeklyReport: false,
            },
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

  // Inboxes list (used by some pages; provide as safety net)
  await page.route("**/api/inboxes**", async (route: Route) => {
    // Don't intercept /api/inboxes/health here — let the specific handler below run
    if (route.request().url().includes("/health")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "inbox_1",
            email: "send@acme.com",
            provider: "smtp",
            status: "active",
            warmupEnabled: true,
            dailySendLimit: 50,
          },
        ],
      }),
    });
  });

  // Inbox health — /api/inboxes/health returns InboxHealth[] in the data wrapper
  await page.route("**/api/inboxes/health**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "inbox_1",
            email: "send@acme.com",
            provider: "smtp",
            status: "active",
            statusBadge: "warming",
            warmupEnabled: true,
            warmupProgressPercent: 75,
            dailyQuotaUsed: 12,
            dailyQuotaTotal: 50,
            bounceRate: 0.02,
          },
        ],
      }),
    });
  });

  // Domains
  await page.route("**/api/domains**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "dom_1",
            domain: "acme.com",
            status: "verified",
            spf: true,
            dkim: true,
            dmarc: true,
          },
        ],
      }),
    });
  });

  // Signatures
  await page.route("**/api/signatures**", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "sig_1",
              name: "My Signature",
              html: "<p>Best, Test</p>",
              isDefault: true,
              createdAt: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });
    } else {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "sig_new",
            name: "New Sig",
            html: "",
            isDefault: false,
            createdAt: new Date().toISOString(),
          },
        }),
      });
    }
  });

  // Security checklist — returns ChecklistData shape
  await page.route("**/api/security/checklist**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          score: 100,
          passedCount: 2,
          total: 2,
          items: [
            {
              id: "smtp_key",
              label: "SMTP encryption key configured",
              description: "Ensures all SMTP connections use TLS.",
              passed: true,
              severity: "critical",
            },
            {
              id: "firebase_env",
              label: "Firebase env vars set",
              description: "Required Firebase env vars are present.",
              passed: true,
              severity: "critical",
            },
          ],
        },
      }),
    });
  });

  // Billing / subscription (used by /settings/payments)
  await page.route("**/api/billing/subscription**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          plans: [],
          currentPlanId: "starter",
          paymentMethod: null,
        },
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Settings tests
// ---------------------------------------------------------------------------

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  // 1. /settings loads without crashing
  test("/settings loads without crashing", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText("Settings")).toBeVisible({ timeout: 8000 });
  });

  // 2. User email "test@example.com" visible
  test("user email is visible on settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("test@example.com")).toBeVisible({ timeout: 8000 });
  });

  // 3. Connected inbox "send@acme.com" visible
  test("connected inbox send@acme.com is visible", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("send@acme.com")).toBeVisible({ timeout: 8000 });
  });

  // 4. Domain "acme.com" with "Verified" status visible
  test("domain acme.com with Verified status is visible", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("acme.com")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Verified").first()).toBeVisible();
  });

  // 5. "Connect Inbox" / "Add Inbox" button present
  test("Add Inbox button is present on settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: /add inbox/i })
    ).toBeVisible({ timeout: 8000 });
  });

  // 6. /settings/signatures loads and shows "My Signature" in list
  test("/settings/signatures loads and shows My Signature", async ({ page }) => {
    await page.goto("/settings/signatures");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText("My Signature")).toBeVisible({ timeout: 8000 });
  });

  // 7. Signature "My Signature" has "Default" badge
  test("My Signature has a Default badge", async ({ page }) => {
    await page.goto("/settings/signatures");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/default/i).first()).toBeVisible({ timeout: 8000 });
  });

  // 8. "Add Signature" button present
  test("Add Signature button is present on signatures page", async ({ page }) => {
    await page.goto("/settings/signatures");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: /add signature/i })
    ).toBeVisible({ timeout: 8000 });
  });

  // 9. /settings/inbox-health loads and shows "send@acme.com" with warmup info
  test("/settings/inbox-health loads and shows send@acme.com", async ({ page }) => {
    await page.goto("/settings/inbox-health");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText("send@acme.com").first()).toBeVisible({ timeout: 8000 });
  });

  // 10. Warmup progress percentage visible ("75%")
  test("inbox health shows warmup progress percentage 75%", async ({ page }) => {
    await page.goto("/settings/inbox-health");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("75%")).toBeVisible({ timeout: 8000 });
  });

  // 11. /settings/security loads and shows checklist items
  test("/settings/security loads and shows checklist items", async ({ page }) => {
    await page.goto("/settings/security");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText("SMTP encryption key configured")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Firebase env vars set")).toBeVisible();
  });

  // 12. Both checklist items show passing state (green check icon rendered — verify via SVG stroke color)
  test("security checklist shows both items as passing", async ({ page }) => {
    await page.goto("/settings/security");
    await page.waitForLoadState("networkidle");

    // The page renders a green checkmark SVG (stroke="#22C55E") for passing items.
    // Verify no red X icons are present (stroke="#F87171" means failed).
    const failIcons = page.locator('svg[stroke="#F87171"]');
    await expect(failIcons).toHaveCount(0, { timeout: 8000 });

    // Confirm green check icons are rendered for both passing items
    const passIcons = page.locator('svg[stroke="#22C55E"]');
    await expect(passIcons).not.toHaveCount(0);
  });

  // 13. /settings/payments loads without crashing (billing info page)
  test("/settings/payments loads without crashing", async ({ page }) => {
    await page.goto("/settings/payments");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/404/);
    // Fallback plans are always rendered when API returns empty plans array
    await expect(page.getByText(/plan|billing|starter|pro/i).first()).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Help page tests
// ---------------------------------------------------------------------------

test.describe("Help Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockClerkSignedIn(page);
    await mockApiRoutes(page);
  });

  // 1. /help loads
  test("/help loads without crashing", async ({ page }) => {
    await page.goto("/help");
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByText(/need help/i)).toBeVisible({ timeout: 8000 });
  });

  // 2. Contact card labels are visible
  test("help page shows all three contact method cards", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByText("WhatsApp")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Email Support")).toBeVisible();
    await expect(page.getByText("Book a Call")).toBeVisible();
  });

  // 3. FAQ section is present
  test("FAQ section is present on help page", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByText(/frequently asked questions/i)
    ).toBeVisible({ timeout: 8000 });
  });

  // 4. FAQ questions are visible (first question visible as-is; first FAQ starts open)
  test("first FAQ question is visible and has an answer shown by default", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByText("How do I connect my email inbox?")
    ).toBeVisible({ timeout: 8000 });
    // The first FAQ opens by default (openFaq state initialised to 0)
    await expect(
      page.getByText(/settings.*connected inboxes/i)
    ).toBeVisible({ timeout: 8000 });
  });

  // 5. Clicking a closed FAQ question expands its answer
  test("clicking a FAQ question expands the answer", async ({ page }) => {
    await page.goto("/help");
    await page.waitForLoadState("networkidle");

    // Click the second question to expand it
    const secondQuestion = page.getByText("Can I customize the email templates?");
    await expect(secondQuestion).toBeVisible({ timeout: 8000 });
    await secondQuestion.click();

    await expect(
      page.getByText(/email styles/i).first()
    ).toBeVisible({ timeout: 4000 });
  });

  // 6. Clicking an open FAQ question collapses it
  test("clicking an already-open FAQ question collapses it", async ({ page }) => {
    await page.goto("/help");
    await page.waitForLoadState("networkidle");

    // The first FAQ is open by default — clicking it should close it
    const firstQuestion = page.getByText("How do I connect my email inbox?");
    await firstQuestion.click();

    // The answer text should disappear
    await expect(
      page.getByText(/settings.*connected inboxes/i)
    ).not.toBeVisible({ timeout: 4000 });
  });

  // 7. "Can I cancel my subscription" FAQ question is present
  test("subscription cancellation FAQ question is visible", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByText("Can I cancel my subscription anytime?")
    ).toBeVisible({ timeout: 8000 });
  });

  // 8. OpenClaw upsell card is present
  test("OpenClaw upsell card is present on help page", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByText(/need more than email/i)
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole("button", { name: /learn more/i })
    ).toBeVisible();
  });

  // 9. Email support link has correct href
  test("Email Support action links to mailto address", async ({ page }) => {
    await page.goto("/help");
    const emailLink = page.getByRole("link", { name: "Send Email" });
    await expect(emailLink).toBeVisible({ timeout: 8000 });
    await expect(emailLink).toHaveAttribute("href", "mailto:support@convergeflow.io");
  });

  // 10. WhatsApp contact link is present and points to wa.me
  test("WhatsApp link is present and points to wa.me", async ({ page }) => {
    await page.goto("/help");
    const waLink = page.getByRole("link", { name: "Open WhatsApp" });
    await expect(waLink).toBeVisible({ timeout: 8000 });
    await expect(waLink).toHaveAttribute("href", /wa\.me/);
  });

  // 11. Book a Call link points to cal.com
  test("Book a Call link points to cal.com", async ({ page }) => {
    await page.goto("/help");
    const calLink = page.getByRole("link", { name: "Schedule" });
    await expect(calLink).toBeVisible({ timeout: 8000 });
    await expect(calLink).toHaveAttribute("href", /cal\.com/);
  });

  // 12. All 5 FAQ questions are rendered
  test("all 5 FAQ questions are rendered", async ({ page }) => {
    await page.goto("/help");
    await page.waitForLoadState("networkidle");

    const faqQuestions = [
      "How do I connect my email inbox?",
      "Can I customize the email templates?",
      "How does lead scoring work?",
      "What happens when someone replies?",
      "Can I cancel my subscription anytime?",
    ];

    for (const question of faqQuestions) {
      await expect(page.getByText(question)).toBeVisible({ timeout: 8000 });
    }
  });

  // 13. Page title is ConvergeFlow
  test("help page has ConvergeFlow in title", async ({ page }) => {
    await page.goto("/help");
    await expect(page).toHaveTitle(/ConvergeFlow/, { timeout: 8000 });
  });

  // 14. Lead scoring FAQ answer expands correctly when clicked
  test("lead scoring FAQ answer expands when clicked", async ({ page }) => {
    await page.goto("/help");
    await page.waitForLoadState("networkidle");

    await page.getByText("How does lead scoring work?").click();
    await expect(
      page.getByText(/company size/i)
    ).toBeVisible({ timeout: 4000 });
  });
});
