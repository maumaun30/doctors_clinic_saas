import { expect, test } from "@playwright/test";
import { USERS, signIn, totp } from "./helpers";

test("admin must set up 2FA, then can use admin pages", async ({ page }) => {
  await signIn(page, USERS.admin);

  // First sign-in: enrol an authenticator. Read the setup key like a user would.
  await expect(page).toHaveURL(/\/mfa/);
  await expect(page.getByRole("heading", { name: "Set up two-factor authentication" })).toBeVisible();
  const secret = (await page.locator("code").first().textContent() ?? "").replace(/\s/g, "");
  await page.locator("#code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on two-factor" }).click();
  await expect(page).toHaveURL(/\/today/);

  await page.goto("/admin/doctors");
  await expect(page.getByText("Dr. E2E Doctor")).toBeVisible();

  await page.goto("/patients/duplicates");
  await expect(page.getByRole("heading", { name: "Possible duplicates" })).toBeVisible();

  // Whole-clinic export answers with a short-lived link to the ZIP.
  const res = await page.request.get("/api/export/clinic", { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const zip = await page.request.get(res.headers().location!);
  expect(zip.ok()).toBeTruthy();
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
});
