"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { countDoctors, ensureCustomer, seatsFor } from "@/lib/billing";
import { priceId, stripe, stripeConfigured } from "@/lib/stripe";

async function requireAdmin() {
  if (!stripeConfigured()) throw new Error("Billing is not configured on this server.");
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin" || !me.account_id) throw new Error("Only admins can manage billing.");
  const { data: { user } } = await sb.auth.getUser();
  const { data: status } = await sb.rpc("my_billing_status");
  return { accountId: me.account_id, email: user?.email, status: status?.[0] };
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

const LIVE = ["active", "trialing", "past_due"];

/** Start Stripe Checkout for a per-doctor subscription. Keeps any unused app trial. */
export async function startCheckout() {
  const { accountId, email, status } = await requireAdmin();
  // Already subscribed: manage it in the portal instead of double-subscribing.
  if (LIVE.includes(status?.subscription_status ?? "")) return openPortal();

  const customer = await ensureCustomer(accountId, email);
  const seats = seatsFor(await countDoctors(accountId));

  // Carry the remaining no-card trial into Stripe so subscribing early
  // doesn't cost trial days. Checkout requires trial_end ≥ 48h out.
  const trialEnd = status?.trial_ends_at ? Math.floor(new Date(status.trial_ends_at).getTime() / 1000) : 0;
  const keepTrial = trialEnd > Math.floor(Date.now() / 1000) + 48 * 3600;

  const base = await origin();
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: accountId,
    line_items: [{ price: priceId(), quantity: seats }],
    subscription_data: {
      metadata: { account_id: accountId },
      ...(keepTrial && { trial_end: trialEnd }),
    },
    allow_promotion_codes: true,
    success_url: `${base}/admin/billing?checkout=success`,
    cancel_url: `${base}/admin/billing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}

/** Open the Stripe Customer Portal (update card, invoices, cancel). */
export async function openPortal() {
  const { accountId, email } = await requireAdmin();
  const customer = await ensureCustomer(accountId, email);
  const session = await stripe().billingPortal.sessions.create({
    customer,
    return_url: `${await origin()}/admin/billing`,
  });
  redirect(session.url);
}
