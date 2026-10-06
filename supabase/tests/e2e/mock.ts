// Test doubles for the reminders e2e run:
//   :9100  fake Resend — records requests, 500s for addresses starting "fail"
//   :9101  fake Semaphore — records requests, returns status Failed for 0999…
//   :9200  maps supabase-js's /rest/v1/* onto a bare PostgREST ($POSTGREST_URL)
const postgrest = Deno.env.get("POSTGREST_URL") ?? "http://localhost:3000";
const got: unknown[] = [];

Deno.serve({ port: 9100 }, async (req) => {
  if (new URL(req.url).pathname === "/_got") return Response.json(got);
  const body = await req.json();
  got.push({ body, idem: req.headers.get("Idempotency-Key"), auth: req.headers.get("Authorization") });
  if (body.to[0].startsWith("fail")) return Response.json({ message: "boom" }, { status: 500 });
  return Response.json({ id: `re_${got.length}` });
});

const sms: unknown[] = [];
Deno.serve({ port: 9101 }, async (req) => {
  if (new URL(req.url).pathname === "/_got") return Response.json(sms);
  const form = Object.fromEntries(new URLSearchParams(await req.text()));
  sms.push(form);
  const failed = form.number.startsWith("0999");
  return Response.json([{
    message_id: 1000 + sms.length, recipient: form.number, message: form.message,
    sender_name: form.sendername ?? "SEMAPHORE", status: failed ? "Failed" : "Queued",
  }]);
});

Deno.serve({ port: 9200 }, async (req) => {
  const u = new URL(req.url);
  const headers = new Headers(req.headers);
  headers.delete("host");
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();
  return fetch(postgrest + u.pathname.replace(/^\/rest\/v1/, "") + u.search, {
    method: req.method, headers, body,
  });
});
