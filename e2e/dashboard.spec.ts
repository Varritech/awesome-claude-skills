import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads dashboard page with all sections", async ({ page }) => {
    await page.goto("/dashboard");

    // Header greeting
    await expect(page.getByText(/Hey there/)).toBeVisible();

    // Inline tip
    await expect(page.getByText(/emails are sending automatically/)).toBeVisible();

    // Metric cards
    await expect(page.getByText("Emails Sent")).toBeVisible();
    await expect(page.getByText("Replies")).toBeVisible();
    await expect(page.getByText("Interested")).toBeVisible();
    await expect(page.getByText("Calls Booked")).toBeVisible();

    // Action cards
    await expect(page.getByText("Send New Emails")).toBeVisible();
    await expect(page.getByText("Find Customers")).toBeVisible();
    await expect(page.getByText("Email Styles")).toBeVisible();

    // Chart section
    await expect(page.getByText("Email Performance")).toBeVisible();

    // Bottom row
    await expect(page.getByText("Your Emails")).toBeVisible();
    await expect(page.getByText("Recent Replies")).toBeVisible();
    await expect(page.getByText("Inbox Health")).toBeVisible();

    // Scale CTA
    await expect(page.getByText("Want to send more emails?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Book a Call" })).toBeVisible();
  });

  test("metric cards display correct values", async ({ page }) => {
    await page.goto("/dashboard");

    // Check specific metric values from the prototype
    await expect(page.getByText("42").first()).toBeVisible();
    await expect(page.getByText("7").first()).toBeVisible();
    await expect(page.getByText("3").first()).toBeVisible();
    await expect(page.getByText("1").first()).toBeVisible();
  });

  test("email status list shows campaigns", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Roofing - Dallas")).toBeVisible();
    await expect(page.getByText("Gutters - Ft Worth")).toBeVisible();
    await expect(page.getByText("Solar - Austin")).toBeVisible();
    await expect(page.getByText("Active")).toBeVisible();
    await expect(page.getByText("Warming")).toBeVisible();
    await expect(page.getByText("Draft")).toBeVisible();
  });

  test("recent replies are displayed", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Mike Thompson")).toBeVisible();
    await expect(page.getByText("Sarah Chen")).toBeVisible();
    await expect(page.getByText("Dave Morrison")).toBeVisible();
  });

  test("mobile: bottom navigation is visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    // Mobile nav items
    await expect(page.getByText("Home")).toBeVisible();
    await expect(page.getByText("Emails")).toBeVisible();
    await expect(page.getByText("Customers")).toBeVisible();
    await expect(page.getByText("Account")).toBeVisible();
  });
});