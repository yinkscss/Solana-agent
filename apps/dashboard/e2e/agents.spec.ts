import { test, expect } from "@playwright/test";

test.describe("Agents page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("solagent_api_key", "sk-test-key-123");
    });
  });

  test("displays agent list with mock data", async ({ page }) => {
    await page.goto("/dashboard/agents");
    await expect(page.getByText("DeFi Trader")).toBeVisible();
    await expect(page.getByText("NFT Monitor")).toBeVisible();
    await expect(page.getByText("Yield Optimizer")).toBeVisible();
    await expect(page.getByText("Portfolio Rebalancer")).toBeVisible();
  });

  test("create agent dialog opens and closes", async ({ page }) => {
    await page.goto("/dashboard/agents");
    await page.getByRole("button", { name: /create agent/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("agent detail page loads", async ({ page }) => {
    await page.goto("/dashboard/agents");
    await page.getByText("DeFi Trader").click();
    await expect(page).toHaveURL(/\/dashboard\/agents\/agent-1/);
    await expect(
      page.getByText("Automated DeFi trading agent")
    ).toBeVisible();
  });
});
