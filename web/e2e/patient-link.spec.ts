import { expect, test } from "@playwright/test";

// Token of the fixture appointment in supabase/seed/e2e.sql.
const TOKEN = "e2e00000000000000001";

test("patient confirms, then cancels, from their reminder link", async ({ page }) => {
  await page.goto(`/a/${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Hi Elena" })).toBeVisible();
  await expect(page.getByText("with Dr. E2E Doctor")).toBeVisible();

  await page.getByRole("button", { name: "I’ll be there" }).click();
  await expect(page.getByText("You’re confirmed")).toBeVisible();

  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Appointment cancelled")).toBeVisible();

  // Reloading shows the saved state.
  await page.reload();
  await expect(page.getByText("Appointment cancelled")).toBeVisible();
});

test("unknown link shows not found", async ({ page }) => {
  const res = await page.goto("/a/00000000000000000000");
  expect(res?.status()).toBe(404);
});
