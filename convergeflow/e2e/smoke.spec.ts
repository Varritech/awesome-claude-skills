import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("root redirects to dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("page loads with correct title", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/ConvergeFlow/);
  });

  test("dark theme is applied", async ({ page }) => {
    await page.goto("/dashboard");
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // #111113 → rgb(17, 17, 19)
    expect(bgColor).toBe("rgb(17, 17, 19)");
  });

  test("no console errors on dashboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});