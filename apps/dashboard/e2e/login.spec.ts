import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /dashboard after entering API key", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("sk-...").fill("sk-test-key-123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("stays on login when API key is empty", async ({ page }) => {
    await page.goto("/login");
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();
    await expect(page).toHaveURL(/\/login/);
  });
});
