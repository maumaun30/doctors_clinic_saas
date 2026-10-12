import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { getMyProfile } from "@/lib/data/queries";
import { openPortal, startCheckout } from "@/lib/actions/billing";
import { syncSeats } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, { variant: BadgeVariant; label: string }> = {
  active:             { variant: "success",     label: "Active" },
  trialing:           { variant: "info",        label: "Trial (Stripe)" },
  past_due:           { variant: "destructive", label: "Payment failed — retrying" },
  unpaid:             { variant: "destructive", label: "Unpaid" },
  canceled:           { variant: "secondary",   label: "Cancelled" },
  incomplete:         { variant: "destructive", label: "Incomplete" },
  incomplete_expired: { variant: "secondary",   label: "Expired" },
  paused:             { variant: "secondary",   label: "Paused" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });

export default async function BillingPage({
  searchParams,
}: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin" || !me.account_id) {
    return <div className="empty">Only admins can manage billing.</div>;
  }

  // Cheap reconciliation: make sure Stripe's seat count matches doctors.
  await syncSeats(me.account_id);
  const { data } = await sb.rpc("my_billing_status");
  const s = data?.[0];
  if (!s) return <div className="empty">No account found.</div>;

  const live = ["active", "trialing", "past_due"].includes(s.subscription_status ?? "");
  const trialLeft = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86_400_000);
  const badge: { variant: BadgeVariant; label: string } = s.subscription_status
    ? STATUS_LABEL[s.subscription_status] ?? { variant: "secondary", label: s.subscription_status }
    : trialLeft > 0 ? { variant: "info", label: "Free trial" }
    : { variant: "destructive", label: "Trial ended" };

  return (
    <>
      <PageHeader icon="card" title="Billing" sub="Billed per doctor, monthly"
        actions={<Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge>} />

      {checkout === "success" && (
        <div className="card" role="status" style={{ padding: 16, marginBottom: 8, maxWidth: 1120 }}>
          Thanks — your subscription is being set up. This page updates once Stripe confirms (usually a few seconds).
        </div>
      )}

      <Section title="Subscription"
        description="Seats follow the number of doctors in your account and are prorated automatically when you add or remove one.">
        <dl className="kv">
          <dt>Status</dt><dd><Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge></dd>
          {!live && (
            <>
              <dt>Free trial</dt>
              <dd>{trialLeft > 0 ? `${trialLeft} day${trialLeft === 1 ? "" : "s"} left (ends ${fmtDate(s.trial_ends_at)})` : `Ended ${fmtDate(s.trial_ends_at)}`}</dd>
            </>
          )}
          <dt>Doctors</dt><dd>{s.doctor_count}{live && s.seat_quantity != null && ` · billed for ${s.seat_quantity} seat${s.seat_quantity === 1 ? "" : "s"}`}</dd>
          {live && s.current_period_end && (<><dt>Renews</dt><dd>{fmtDate(s.current_period_end)}</dd></>)}
        </dl>

        {!s.is_active && (
          <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: 16 }}>
            Your account is read-only: staff can view records but can’t add or change anything until you subscribe.
          </p>
        )}

      </Section>

      <Section title="Payment & invoices"
        description="Cards, invoices and cancellation are handled securely by Stripe.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!stripeConfigured() ? (
            <p className="hint">Billing isn’t configured on this server (STRIPE_SECRET_KEY / STRIPE_PRICE_ID).</p>
          ) : live ? (
            <form action={openPortal}><Button>Manage billing</Button></form>
          ) : (
            <>
              <form action={startCheckout}><Button>Subscribe</Button></form>
              {s.has_customer && <form action={openPortal}><Button variant="outline">Billing history</Button></form>}
            </>
          )}
        </div>
      </Section>
    </>
  );
}
