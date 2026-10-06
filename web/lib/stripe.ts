import "server-only";
import Stripe from "stripe";

// Server-only Stripe client. Env:
//   STRIPE_SECRET_KEY      sk_test_… / sk_live_…
//   STRIPE_PRICE_ID        recurring per-seat price (price_…), billed × doctors
//   STRIPE_WEBHOOK_SECRET  whsec_… for /api/stripe/webhook
//   STRIPE_API_BASE        optional, e.g. http://localhost:12111 for stripe-mock

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  client = new Stripe(key, {
    appInfo: { name: "doctors-clinic-saas" },
    ...(base && {
      host: base.hostname,
      port: Number(base.port) || (base.protocol === "https:" ? 443 : 80),
      protocol: base.protocol.replace(":", "") as "http" | "https",
    }),
  });
  return client;
}

export function priceId(): string {
  const p = process.env.STRIPE_PRICE_ID;
  if (!p) throw new Error("STRIPE_PRICE_ID is not set");
  return p;
}
