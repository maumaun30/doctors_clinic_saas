import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { openPortal, startCheckout } from "@/lib/actions/billing";
import { syncSeats } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";

const STATUS_LABEL: Record<string, { cls: string; label: string }> = {
  active:   { cls: "badge badge-green", label: "Active" },
  trialing: { cls: "badge badge-blue",  label: "Trial (Stripe)" },
  past_due: { cls: "badge badge-red",   label: "Payment failed — retrying" },
  unpaid:   { cls: "badge badge-red",   label: "Unpaid" },
  canceled: { cls: "badge",             label: "Cancelled" },
  incomplete: { cls: "badge badge-red", label: "Incomplete" },
  incomplete_expired: { cls: "badge",   label: "Expired" },
  paused:   { cls: "badge",             label: "Paused" },
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
  const badge = s.subscription_status ? STATUS_LABEL[s.subscription_status] ?? { cls: "badge", label: s.subscription_status }
    : trialLeft > 0 ? { cls: "badge badge-blue", label: "Free trial" }
    : { cls: "badge badge-red", label: "Trial ended" };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <div className="sub">Billed per doctor, monthly</div>
        </div>
      </div>

      {checkout === "success" && (
        <div className="card" role="status" style={{ padding: 16, marginBottom: 16 }}>
          Thanks — your subscription is being set up. This page updates once Stripe confirms (usually a few seconds).
        </div>
      )}

      <div className="card" style={{ padding: 24, maxWidth: 640 }}>
        <dl className="kv">
          <dt>Status</dt><dd><span className={badge.cls}><span className="dot" />{badge.label}</span></dd>
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

        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          {!stripeConfigured() ? (
            <p className="hint">Billing isn’t configured on this server (STRIPE_SECRET_KEY / STRIPE_PRICE_ID).</p>
          ) : live ? (
            <form action={openPortal}><button className="btn btn-primary">Manage billing</button></form>
          ) : (
            <>
              <form action={startCheckout}><button className="btn btn-primary">Subscribe</button></form>
              {s.has_customer && <form action={openPortal}><button className="btn btn-secondary">Billing history</button></form>}
            </>
          )}
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          Seats follow the number of doctors in your account and are prorated automatically when you add or remove one.
        </p>
      </div>
    </>
  );
}
