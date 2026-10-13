import { expect, test } from "@playwright/test";
import { IDS, PASSWORD, USERS, signIn, signInAs, tomorrowPh } from "./helpers";

test("wrong password shows an error and stays on login", async ({ page }) => {
  await signIn(page, USERS.secretary, `${PASSWORD}-wrong`);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("secretary adds a patient and books them", async ({ page }) => {
  await signInAs(page, "secretary");

  await page.goto("/patients");
  await page.getByRole("button", { name: "Add patient" }).first().click();
  const add = page.getByRole("dialog");
  await add.getByLabel("Full name").fill("Paolo Browser");
  await add.getByLabel("Mobile").fill("0917 000 0202");
  await add.getByRole("button", { name: /add patient|save/i }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Paolo Browser" })).toBeVisible();

  // Secretaries see contact details, not clinical tools.
  await expect(page.getByRole("link", { name: "Export record" })).toHaveCount(0);

  await page.getByRole("button", { name: "New visit" }).click();
  const book = page.getByRole("dialog");
  await book.getByLabel("Provider").selectOption({ label: "Dr. E2E Doctor" });
  await book.getByLabel("Date").fill(tomorrowPh());
  const slot = book.getByRole("radiogroup", { name: "Open times" }).getByRole("radio").first();
  await slot.click();
  await book.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByText("Appointment booked")).toBeVisible();
  await expect(book).toBeHidden();
});

test("secretary can't open admin pages", async ({ page }) => {
  await signInAs(page, "secretary");
  await page.goto("/admin/doctors");
  await expect(page).toHaveURL(/\/today/);
});

test("doctor records and completes a visit", async ({ page }) => {
  await signInAs(page, "doctor");
  await page.goto(`/visits/${IDS.openAppointment}`);

  await page.getByLabel("Blood pressure").fill("120/80");
  await page.getByLabel("Chief complaint").fill("Cough for 5 days");
  await page.getByLabel("Diagnosis").fill("Acute upper respiratory infection");
  await page.getByLabel("Search or add a medication").fill("Parac");
  await page.getByRole("button", { name: "Paracetamol" }).click();
  await expect(page.getByLabel("Dosage")).toHaveValue("500 mg"); // prefilled from the library

  await page.getByRole("button", { name: "Complete visit" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Complete visit" }).click();
  await expect(page.getByText("Acute upper respiratory infection")).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete visit" })).toHaveCount(0);

  // The record shows on the patient's chart and in their exported record.
  await page.goto(`/patients/${IDS.patient}/record`);
  await expect(page.getByText("Acute upper respiratory infection")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Paracetamol" })).toBeVisible();
});
