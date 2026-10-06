import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceId, stripe, stripeConfigured } from "@/lib/stripe";

// Billing core: map Stripe subscription state onto `accounts` and keep
// the seat count (= doctors in the account) in sync. Runs with the
// service key — callers must have authorized the user already (or be the
// signature-verified webhook).

export async function countDoctors(accountId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("role", "doctor");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Stripe needs quantity ≥ 1; an account with no doctors yet pays one seat. */
export const seatsFor = (doctors: number) => Math.max(1, doctors);

/** Write a subscription's state onto its account. Returns the account id, or null if unknown. */
export async function applySubscription(sub: Stripe.Subscription): Promise<string | null> {
  const db = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let accountId = sub.metadata?.account_id || null;
  if (!accountId) {
    const { data } = await db.from("accounts").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    accountId = data?.id ?? null;
  }
  if (!accountId) return null;

  const item = sub.items.data[0];
  const { error } = await db.from("accounts").update({
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    seat_quantity: item?.quantity ?? null,
  }).eq("id", accountId);
  if (error) throw new Error(error.message);
  return accountId;
}

/**
 * Set the subscription quantity to the current doctor count (prorated).
 * No-op without Stripe config or a live subscription. Never throws — a
 * seat-sync failure must not break the admin action that triggered it;
 * the billing page re-syncs on load.
 */
export async function syncSeats(accountId: string): Promise<void> {
  if (!stripeConfigured()) return;
  try {
    const db = createAdminClient();
    const { data: acc } = await db.from("accounts")
      .select("stripe_subscription_id, subscription_status")
      .eq("id", accountId).maybeSingle();
    if (!acc?.stripe_subscription_id) return;
    if (!["active", "trialing", "past_due"].includes(acc.subscription_status ?? "")) return;

    const want = seatsFor(await countDoctors(accountId));
    const sub = await stripe().subscriptions.retrieve(acc.stripe_subscription_id);
    const item = sub.items.data.find(i => i.price.id === priceId()) ?? sub.items.data[0];
    if (!item || item.quantity === want) {
      await applySubscription(sub);
      return;
    }
    const updated = await stripe().subscriptions.update(sub.id, {
      items: [{ id: item.id, quantity: want }],
      proration_behavior: "create_prorations",
    });
    await applySubscription(updated);
  } catch (e) {
    console.error(`[billing] seat sync failed for account ${accountId}:`, e);
  }
}

/** Find or create the Stripe customer for an account. */
export async function ensureCustomer(accountId: string, email: string | undefined): Promise<string> {
  const db = createAdminClient();
  const { data: acc, error } = await db.from("accounts")
    .select("name, stripe_customer_id").eq("id", accountId).single();
  if (error) throw new Error(error.message);
  if (acc.stripe_customer_id) return acc.stripe_customer_id;

  const customer = await stripe().customers.create(
    { name: acc.name, email, metadata: { account_id: accountId } },
    { idempotencyKey: `customer-${accountId}` },
  );
  // Only claim the slot if nobody beat us to it.
  const { data: claimed } = await db.from("accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", accountId).is("stripe_customer_id", null)
    .select("stripe_customer_id").maybeSingle();
  if (claimed) return customer.id;
  const { data: again } = await db.from("accounts").select("stripe_customer_id").eq("id", accountId).single();
  return again!.stripe_customer_id!;
}
