// Assertions for the reminders e2e run (see run.sh).
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const fn = "http://localhost:8000";
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) { console.log(`FAIL ${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); Deno.exit(1); }
  console.log(`ok: ${m}`);
};
let r = await fetch(fn); eq(r.status, 401, "no auth -> 401"); await r.body?.cancel();
r = await fetch(fn, { headers: { Authorization: "Bearer wrong" } }); eq(r.status, 401, "wrong key -> 401"); await r.body?.cancel();
const run = async () => (await fetch(fn, { headers: { Authorization: `Bearer ${key}` } })).json();
const counts = (c: any) => [c.sent, c.failed, c.skipped, c.dry_run];
let j = await run();
eq(counts(j.email), [1, 1, 2, false], "email run 1: 1 sent, 1 failed, 2 without email");
eq(counts(j.sms), [2, 1, 1, false], "sms run 1: 2 sent, 1 failed, 1 non-mobile");
j = await run();
eq(counts(j.email), [0, 1, 2, false], "email run 2: sent not repeated, failure retried");
eq(counts(j.sms), [0, 1, 1, false], "sms run 2: sent not repeated, failure retried");
eq(j.ok, false, "ok=false while a channel has failures");
const got = await (await fetch("http://localhost:9100/_got")).json();
const ana = got.filter((g: any) => g.body.to[0] === "ana@example.com");
eq(ana.length, 1, "ana emailed exactly once");
eq(ana[0].auth, "Bearer re_test", "resend key sent");
eq(ana[0].body.from, "Clinic <r@example.com>", "from header");
eq(ana[0].body.subject.includes("Dr Santos"), true, "subject names doctor");
eq(ana[0].body.html.includes("Ana &lt;Reyes&gt;"), true, "html escapes patient name");
eq(ana[0].body.html.includes("Bayside Clinic, 2 Roxas Blvd"), true, "html has clinic + address");
eq(typeof ana[0].idem === "string" && ana[0].idem.startsWith("reminder-"), true, "idempotency key set");

const texts = await (await fetch("http://localhost:9101/_got")).json();
eq(texts.filter((t: any) => t.number === "09171112222").length, 1, "ana texted exactly once, number normalized");
eq(texts.filter((t: any) => t.number === "09182223333").length, 1, "sms-only patient texted");
eq(texts.some((t: any) => t.number.startsWith("02")), false, "landline never texted");
const t = texts.find((t: any) => t.number === "09171112222");
eq([t.apikey, t.sendername], ["sem_test", "BAYSIDE"], "semaphore key + sender name sent");
eq(t.message.startsWith("Reminder: Dr Santos,") && t.message.length <= 160, true, "sms text shape");
console.log("subject:", ana[0].body.subject);
console.log("sms:", t.message);
