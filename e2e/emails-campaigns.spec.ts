import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMAIL_FIXTURE = {
  id: "em_1",
  subject: "Quick question",
  body: "Hi Alex...",
  status: "draft" as const,
  persona: "closer" as const,
  leadId: "ld_1",
  campaignId: "cmp_1",
  scheduledFor: null,
  sentAt: null,
  createdAt: new Date().toISOString(),
};

// The email detail page (`/emails/[id]`) renders EmailCampaignDetail, not a raw
// EmailRecord, so we return the campaign-detail shape for GET /api/emails/em_1.
const CAMPAIGN_DETAIL_FIXTURE = {
  id: "em_1",
  name: "Quick question",
  style: "The Closer",
  status: "draft" as const,
  sent: 0,
  total: 10,
  replied: 0,
  interested: 0,
  openRate: "0%",
  emails: [],
};

const CAMPAIGN_FIXTURE = {
  id: "cmp_1",
  name: "Q2 SaaS founders",
  status: "running" as const,
  persona: "closer" as const,
  sentCount: 42,
  repliedCount: 7,
  bookedCount: 3,
};

// Campaign detail for the campaign detail page
const CAMPAIGN_DETAIL_CMP1 = {
  id: "cmp_1",
  name: "Q2 SaaS founders",
  style: "The Closer",
  status: "active" as const,
  sent: 42,
  total: 100,
  replied: 7,
  interested: 3,
  openRate: "38%",
  emails: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockEmailsApi(page: Page) {
  // GET /api/emails → list
  await page.route("**/api/emails", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [EMAIL_FIXTURE] }),
      });
    } else {
      // POST /api/emails (new email creation)
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "em_new" } }),
      });
    }
  });

  // GET /api/emails/em_1 → campaign detail shape
  await page.route("**/api/emails/em_1", async (route: Route) => {
    if (
      route.request().method() === "GET" &&
      !route.request().url().includes("/generate") &&
      !route.request().url().includes("/send")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CAMPAIGN_DETAIL_FIXTURE),
      });
    } else {
      // Fallthrough to more-specific route handlers
      await route.continue();
    }
  });

  // POST /api/emails/em_1/generate → SSE stream
  await page.route("**/api/emails/em_1/generate", async (route: Route) => {
    // Return a minimal SSE body the apiStream helper can parse
    const body =
      `data: ${JSON.stringify({ response: "AI body", done: false })}\n\n` +
      `data: ${JSON.stringify({ done: true })}\n\n`;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body,
    });
  });

  // POST /api/emails/em_1/send
  await page.route("**/api/emails/em_1/send", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { sent: true } }),
    });
  });

  // Also silence auto-draft endpoint
  await page.route("**/api/emails/auto-draft", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
}

async function mockCampaignsApi(page: Page) {
  // GET /api/campaigns → list
  await page.route("**/api/campaigns", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [CAMPAIGN_FIXTURE] }),
      });
    } else {
      // POST /api/campaigns (create)
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "cmp_new" } }),
      });
    }
  });

  // GET /api/campaigns/cmp_1 → campaign detail
  await page.route("**/api/campaigns/cmp_1", async (route: Route) => {
    if (
      route.request().method() === "GET" &&
      !route.request().url().includes("/pause") &&
      !route.request().url().includes("/start")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CAMPAIGN_DETAIL_CMP1),
      });
    } else {
      await route.continue();
    }
  });

  // POST /api/campaigns/cmp_1/pause
  await page.route("**/api/campaigns/cmp_1/pause", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { paused: true } }),
    });
  });

  // POST /api/campaigns/cmp_1/start
  await page.route("**/api/campaigns/cmp_1/start", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { started: true } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests — /emails list
// ---------------------------------------------------------------------------

test.describe("Emails list (/emails)", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmailsApi(page);
    await mockCampaignsApi(page);
  });

  // 1. Page loads without crashing
  test("page loads without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/emails");
    await expect(page).not.toHaveURL(/404/);
    await page.waitForLoadState("networkidle");

    // No fatal JS errors
    const fatalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("net::ERR") &&
        !e.includes("Failed to load resource")
    );
    expect(fatalErrors).toHaveLength(0);
  });

  // 2. Email subject visible in list
  test('email subject "Quick question" is visible in list', async ({ page }) => {
    await page.goto("/emails");
    await expect(page.getByText("Quick question")).toBeVisible({ timeout: 8000 });
  });

  // 3. Clicking email row navigates to /emails/em_1
  test("clicking email row navigates to /emails/em_1", async ({ page }) => {
    await page.goto("/emails");
    await page.getByText("Quick question").click();
    await expect(page).toHaveURL(/\/emails\/em_1/, { timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// Tests — /emails/em_1 detail
// ---------------------------------------------------------------------------

test.describe("Email detail (/emails/em_1)", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmailsApi(page);
    await mockCampaignsApi(page);
  });

  // 4. Detail page shows subject (used as campaign name) and body / style content
  test("shows campaign name and style content", async ({ page }) => {
    await page.goto("/emails/em_1");
    await page.waitForLoadState("networkidle");

    // The detail page renders campaign.name as the h1 heading
    await expect(page.getByRole("heading", { name: "Quick question" })).toBeVisible({
      timeout: 8000,
    });
    // Style text is shown as "<style> style"
    await expect(page.getByText(/The Closer/i)).toBeVisible({ timeout: 8000 });
  });

  // 5. "Regenerate" button present on email detail
  test('"Regenerate" button is present', async ({ page }) => {
    await page.goto("/emails/em_1");
    await expect(
      page.getByRole("button", { name: /regenerate/i })
    ).toBeVisible({ timeout: 8000 });
  });

  // 6. Clicking "Regenerate" calls POST /api/emails/em_1/generate
  test('clicking "Regenerate" calls POST /api/emails/[id]/generate', async ({ page }) => {
    let generateCalled = false;

    // Override the generate route to track the call
    await page.route("**/api/emails/em_1/generate", async (route: Route) => {
      generateCalled = true;
      const body =
        `data: ${JSON.stringify({ response: "AI subject", done: false })}\n\n` +
        `data: ${JSON.stringify({ response: " AI body", done: false })}\n\n` +
        `data: ${JSON.stringify({ done: true })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body,
      });
    });

    await page.goto("/emails/em_1");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /regenerate/i }).click();

    // Wait for the async stream to complete
    await page.waitForFunction(() => generateCalled || true, { timeout: 6000 }).catch(() => {});
    await expect(async () => {
      expect(generateCalled).toBe(true);
    }).toPass({ timeout: 6000 });
  });

  // 7. "Start" button present on email detail (campaign not yet active → shows Start)
  test('"Start" button is present for a draft/non-active campaign', async ({ page }) => {
    await page.goto("/emails/em_1");
    // CAMPAIGN_DETAIL_FIXTURE has status "draft" → shows "Start"
    await expect(
      page.getByRole("button", { name: /^start$/i })
    ).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Tests — Campaign detail via /emails/cmp_1
// ---------------------------------------------------------------------------

test.describe("Campaign detail via email route (/emails/cmp_1)", () => {
  test.beforeEach(async ({ page }) => {
    // Route the cmp_1 email detail to return the active campaign shape
    await page.route("**/api/emails/cmp_1", async (route: Route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(CAMPAIGN_DETAIL_CMP1),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/campaigns/cmp_1/pause", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { paused: true } }),
      });
    });

    await page.route("**/api/campaigns/cmp_1/start", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { started: true } }),
      });
    });

    // Silence generate for this suite
    await page.route("**/api/emails/cmp_1/generate", async (route: Route) => {
      const body = `data: ${JSON.stringify({ done: true })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body,
      });
    });
  });

  // 8. Campaign list shows "Q2 SaaS founders" — tested via the email detail
  //    which renders the campaign name as an h1.
  test('campaign name "Q2 SaaS founders" renders on the detail page', async ({ page }) => {
    await page.goto("/emails/cmp_1");
    await expect(
      page.getByRole("heading", { name: "Q2 SaaS founders" })
    ).toBeVisible({ timeout: 8000 });
  });

  // 8b. Status badge renders "Active" for an active campaign
  test('"Active" status badge is visible for running campaign', async ({ page }) => {
    await page.goto("/emails/cmp_1");
    // The badge renders the label from campaignStatusBadge["active"] = "Active"
    await expect(page.getByText("Active")).toBeVisible({ timeout: 8000 });
  });

  // 9. Pause button calls /api/campaigns/cmp_1/pause
  test("pause button calls /api/campaigns/cmp_1/pause", async ({ page }) => {
    let pauseCalled = false;

    await page.route("**/api/campaigns/cmp_1/pause", async (route: Route) => {
      pauseCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { paused: true } }),
      });
    });

    await page.goto("/emails/cmp_1");
    await page.waitForLoadState("networkidle");

    // Active campaign → shows "Pause" button
    const pauseBtn = page.getByRole("button", { name: /^pause$/i });
    await expect(pauseBtn).toBeVisible({ timeout: 8000 });
    await pauseBtn.click();

    await expect(async () => {
      expect(pauseCalled).toBe(true);
    }).toPass({ timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// Tests — New Email / Campaign creation
// ---------------------------------------------------------------------------

test.describe("New Email creation", () => {
  test.beforeEach(async ({ page }) => {
    await mockEmailsApi(page);
    await mockCampaignsApi(page);
  });

  // 10. "New Email" button is present on /emails and clicking it triggers
  //     POST /api/emails (create) then navigates to the new email.
  test('"New Email" button is present and submits POST /api/emails', async ({ page }) => {
    let createCalled = false;

    await page.route("**/api/emails", async (route: Route) => {
      if (route.request().method() === "POST") {
        createCalled = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: "em_new" } }),
        });
      } else {
        // GET — return the list
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [EMAIL_FIXTURE] }),
        });
      }
    });

    // Silence the new email detail GET so navigation doesn't error
    await page.route("**/api/emails/em_new", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "em_new",
          name: "New email",
          style: "The Neighbor",
          status: "draft",
          sent: 0,
          total: 0,
          replied: 0,
          interested: 0,
          openRate: "0%",
          emails: [],
        }),
      });
    });

    // Also silence auto-draft
    await page.route("**/api/emails/auto-draft", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
    });

    await page.goto("/emails");
    await expect(page.getByText("Quick question")).toBeVisible({ timeout: 8000 });

    const newEmailBtn = page.getByRole("button", { name: /new email/i });
    await expect(newEmailBtn).toBeVisible();
    await newEmailBtn.click();

    // POST /api/emails should have been called
    await expect(async () => {
      expect(createCalled).toBe(true);
    }).toPass({ timeout: 6000 });

    // Should navigate to the new email detail
    await expect(page).toHaveURL(/\/emails\/em_new/, { timeout: 6000 });
  });
});
