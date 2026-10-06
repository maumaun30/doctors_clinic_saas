import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { applySubscription, syncSeats } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

// Stripe webhook. Configure in Stripe → Developers → Webhooks:
//   URL:    https://<domain>/api/stripe/webhook
//   Events: checkout.session.completed, customer.subscription.created,
//           customer.subscription.updated, customer.subscription.deleted
//
// Events can arrive out of order or more than once, so we never trust
// the event payload's snapshot: we re-fetch the subscription and write
// its current state, and skip event ids we've already processed.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, sig ?? "", secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true, ignored: event.type });

  const db = createAdminClient();
  const { data: fresh, error: dupErr } = await db.from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 });
  if (!fresh?.length) return NextResponse.json({ received: true, duplicate: true });

  try {
    const subId = subscriptionIdOf(event);
    if (subId) {
      const sub = await stripe().subscriptions.retrieve(subId);
      const accountId = await applySubscription(sub);
      // First subscription: doctors may have been added since checkout started.
      if (accountId && event.type === "checkout.session.completed") await syncSeats(accountId);
      return NextResponse.json({ received: true, account: accountId });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    // Let Stripe retry: forget the event id so the retry is processed.
    await db.from("stripe_events").delete().eq("id", event.id);
    console.error("[stripe webhook]", event.type, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

function subscriptionIdOf(event: Stripe.Event): string | null {
  const obj = event.data.object as { object: string; id: string; subscription?: string | { id: string } | null };
  if (obj.object === "subscription") return obj.id;
  if (obj.object === "checkout.session" && obj.subscription) {
    return typeof obj.subscription === "string" ? obj.subscription : obj.subscription.id;
  }
  return null;
}
