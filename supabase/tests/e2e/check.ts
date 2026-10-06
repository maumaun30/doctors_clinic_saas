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
let j = await run();
eq([j.sent, j.failed, j.skipped_no_email, j.dry_run], [1, 1, 1, false], "first run: 1 sent, 1 failed, 1 no-email");
j = await run();
eq([j.sent, j.failed, j.skipped_no_email], [0, 1, 1], "second run: sent not repeated, failure retried");
const got = await (await fetch("http://localhost:9100/_got")).json();
const ana = got.filter((g: any) => g.body.to[0] === "ana@example.com");
eq(ana.length, 1, "ana emailed exactly once");
eq(ana[0].auth, "Bearer re_test", "resend key sent");
eq(ana[0].body.from, "Clinic <r@example.com>", "from header");
eq(ana[0].body.subject.includes("Dr Santos"), true, "subject names doctor");
eq(ana[0].body.html.includes("Ana &lt;Reyes&gt;"), true, "html escapes patient name");
eq(ana[0].body.html.includes("Bayside Clinic, 2 Roxas Blvd"), true, "html has clinic + address");
eq(typeof ana[0].idem === "string" && ana[0].idem.startsWith("reminder-"), true, "idempotency key set");
console.log("subject:", ana[0].body.subject);
