import { expect, test } from "@playwright/test";
import { tomorrowPh } from "./helpers";

test("patient books online without an account", async ({ page }) => {
  await page.goto("/book/e2e-clinic");
  await expect(page.getByRole("heading", { name: "Book an appointment" })).toBeVisible();
  await expect(page.getByText("E2E Clinic").first()).toBeVisible();

  const doctor = page.getByRole("radiogroup", { name: "Doctor" });
  if (await doctor.count()) await doctor.getByRole("radio").first().click();
  else await page.getByLabel("Doctor").selectOption({ index: 1 });

  await page.getByRole("button", { name: /^Tomorrow/ }).click();
  await expect(page.getByLabel("Another date")).toHaveValue(tomorrowPh());
  await page.getByRole("radiogroup", { name: "Available times" }).getByRole("radio").first().click();
  await page.getByLabel("Full name").fill("Rosa Online");
  await page.getByLabel("Mobile number").fill("0917 000 0303");
  await page.getByRole("button", { name: /^Book / }).click();

  await expect(page.getByText("You’re booked")).toBeVisible();
});
