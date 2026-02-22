import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("solagent_api_key", "sk-test-key-123");
    });
  });

  test("shows stat cards on dashboard overview", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Total Agents")).toBeVisible();
    await expect(page.getByText("Wallets")).toBeVisible();
    await expect(page.getByText("Transactions (24h)")).toBeVisible();
    await expect(page.getByText("Active Policies")).toBeVisible();
  });

  test("sidebar navigation to Agents works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Agents" }).click();
    await expect(page).toHaveURL(/\/dashboard\/agents/);
    await expect(page.getByText("Manage your AI agents")).toBeVisible();
  });

  test("sidebar navigation to Transactions works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/dashboard\/transactions/);
    await expect(
      page.getByText("View and filter transaction history")
    ).toBeVisible();
  });

  test("sidebar navigation to Monitoring works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Monitoring" }).click();
    await expect(page).toHaveURL(/\/dashboard\/monitoring/);
    await expect(
      page.getByText("Real-time platform metrics and dashboards")
    ).toBeVisible();
  });

  test("each page renders without errors", async ({ page }) => {
    const routes = [
      "/dashboard",
      "/dashboard/agents",
      "/dashboard/wallets",
      "/dashboard/transactions",
      "/dashboard/policies",
      "/dashboard/monitoring",
      "/dashboard/settings",
    ];

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
    }
  });
});
