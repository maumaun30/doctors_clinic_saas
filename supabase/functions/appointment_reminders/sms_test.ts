import { assertEquals, assert } from "jsr:@std/assert@1";
import { buildSms, normalizePhMobile, toAscii } from "./sms.ts";

Deno.test("normalizePhMobile accepts common PH formats", () => {
  for (const raw of ["09171234567", "0917 123 4567", "+63 917 123 4567", "639171234567", "9171234567", "(0917) 123-4567"]) {
    assertEquals(normalizePhMobile(raw), "09171234567", raw);
  }
});

Deno.test("normalizePhMobile rejects non-mobiles", () => {
  for (const raw of [null, "", "12", "02 8123 4567", "+1 415 555 0100", "0817123456", "091712345678"]) {
    assertEquals(normalizePhMobile(raw), null, String(raw));
  }
});

Deno.test("toAscii strips accents and non-ASCII", () => {
  assertEquals(toAscii("Dr. Peña — Niño  Clinic ✓"), "Dr. Pena Nino Clinic");
});

const at = "2026-10-07T01:30:00Z"; // Wed Oct 7, 9:30 AM Manila

Deno.test("buildSms basic shape", () => {
  const m = buildSms({ scheduled_at: at, doctor_name: "Dr. Ana Santos", clinic_name: "Bayside Clinic" });
  assertEquals(m, "Reminder: Dr. Ana Santos, Wed, Oct 7, 9:30 AM at Bayside Clinic. To reschedule, call the clinic.");
});

Deno.test("buildSms stays ASCII, <=160, and never starts with TEST", () => {
  const long = "Test ".repeat(40);
  for (const [d, c] of [[long, long], ["Dr. Ñiño", "TEST Clinic"], ["X", long], [long, "Y"]]) {
    const m = buildSms({ scheduled_at: at, doctor_name: d, clinic_name: c });
    assert(m.length <= 160, `len ${m.length}: ${m}`);
    assert(/^[\x20-\x7E]+$/.test(m), m);
    assert(m.startsWith("Reminder:"), m);
    assert(m.includes("9:30 AM"), m);
  }
});
