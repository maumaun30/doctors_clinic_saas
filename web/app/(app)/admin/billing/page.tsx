import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, CreditCardIcon, InfoIcon, LockIcon, StethoscopeIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/_components/page-header";
import { getMyProfile } from "@/lib/data/queries";
import { openPortal, startCheckout } from "@/lib/actions/billing";
import { getSeatPrice, seatsFor, syncSeats } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "./submit-button";
import { cn } from "@/lib/utils";

const TRIAL_DAYS = 14;
const STATUS: Record<string, { variant: BadgeVariant; label: string }> = {
  active:             { variant: "success",     label: "Active" },
  trialing:           { variant: "info",        label: "Trial (card on file)" },
  past_due:           { variant: "destructive", label: "Payment failed — retrying" },
  unpaid:             { variant: "destructive", label: "Unpaid" },
  canceled:           { variant: "secondary",   label: "Cancelled" },
  incomplete:         { variant: "destructive", label: "Incomplete" },
  incomplete_expired: { variant: "secondary",   label: "Expired" },
  paused:             { variant: "secondary",   label: "Paused" },
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin" || !me.account_id) {
    return <div className="card empty">Only admins can manage billing.</div>;
  }

  // Cheap reconciliation: make sure Stripe's seat count matches doctors.
  await syncSeats(me.account_id);
  const [{ data }, price] = await Promise.all([sb.rpc("my_billing_status"), getSeatPrice()]);
  const s = data?.[0];
  if (!s) return <div className="card empty">No account found.</div>;

  const configured = stripeConfigured();
  const live = ["active", "trialing", "past_due"].includes(s.subscription_status ?? "");
  const trialLeft = Math.ceil((new Date(s.trial_ends_at).getTime() - Date.now()) / 86_400_000);
  const onAppTrial = !live && trialLeft > 0;
  const badge = s.subscription_status
    ? STATUS[s.subscription_status] ?? { variant: "secondary" as const, label: s.subscription_status }
    : onAppTrial ? { variant: "info" as const, label: "Free trial" } : { variant: "destructive" as const, label: "Trial ended" };
  const seats = live && s.seat_quantity != null ? s.seat_quantity : seatsFor(s.doctor_count);
  const total = price ? price.amount * seats : null;

  return (
    <>
      <PageHeader icon="card" title="Billing" sub="One plan, billed per doctor each month"
        actions={<Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge>} />

      <div className="grid gap-4">
        {checkout === "success" && (
          <Alert className="border-(--success)/30 bg-(--success-subtle) text-(--success)">
            <CheckCircle2Icon />
            <AlertTitle>Thanks — you’re subscribed</AlertTitle>
            <AlertDescription className="text-(--success)">Stripe is confirming the payment; this page updates within a few seconds.</AlertDescription>
          </Alert>
        )}
        {checkout === "cancelled" && (
          <Alert>
            <InfoIcon />
            <AlertTitle>Checkout cancelled</AlertTitle>
            <AlertDescription>Nothing was charged. You can subscribe whenever you’re ready.</AlertDescription>
          </Alert>
        )}
        {!s.is_active && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <LockIcon />
            <AlertTitle>Your account is read-only</AlertTitle>
            <AlertDescription>Staff can view records but can’t add or change anything until you subscribe.</AlertDescription>
          </Alert>
        )}
        {s.subscription_status === "past_due" && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertTriangleIcon />
            <AlertTitle>Your last payment failed</AlertTitle>
            <AlertDescription>Stripe will retry automatically. Update your card under Manage billing to avoid interruption.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Your plan</CardTitle>
              <CardDescription>
                {live && s.current_period_end ? `Renews ${fmtDate(s.current_period_end)}`
                  : onAppTrial ? `Free trial — no card needed until ${fmtDate(s.trial_ends_at)}`
                  : `Free trial ended ${fmtDate(s.trial_ends_at)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <div className="text-3xl font-semibold tabular-nums">{total != null && price ? money(total, price.currency) : "—"}</div>
                  <div className="text-sm text-muted-foreground">
                    {price ? `per ${price.interval} · ${seats} seat${seats === 1 ? "" : "s"} × ${money(price.amount, price.currency)}` : "Price shown at checkout"}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <StethoscopeIcon className="size-4 text-primary" />
                  <span><span className="font-semibold tabular-nums">{s.doctor_count}</span> doctor{s.doctor_count === 1 ? "" : "s"}</span>
                  <Link href="/admin/doctors" className="text-primary hover:underline">View</Link>
                </div>
              </div>

              {onAppTrial && (
                <div className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{trialLeft} day{trialLeft === 1 ? "" : "s"} of free trial left</span>
                    <span className="text-muted-foreground">{TRIAL_DAYS}-day trial</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={TRIAL_DAYS}
                    aria-valuenow={Math.max(0, TRIAL_DAYS - trialLeft)} aria-label="Trial used">
                    <div className={cn("h-2 rounded-full", trialLeft <= 3 ? "bg-(--warning)" : "bg-primary")}
                      style={{ width: `${Math.min(100, Math.max(4, ((TRIAL_DAYS - trialLeft) / TRIAL_DAYS) * 100))}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Subscribe early with 2+ days left and you keep the remaining trial — the first charge waits until it ends.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-wrap gap-2">
              {!configured ? (
                <p className="text-sm text-muted-foreground">Billing isn’t configured on this server (STRIPE_SECRET_KEY / STRIPE_PRICE_ID).</p>
              ) : live ? (
                <form action={openPortal}><SubmitButton pendingText="Opening Stripe…"><CreditCardIcon /> Manage billing</SubmitButton></form>
              ) : (
                <>
                  <form action={startCheckout}><SubmitButton pendingText="Opening checkout…">Subscribe</SubmitButton></form>
                  {s.has_customer && (
                    <form action={openPortal}><SubmitButton variant="outline" pendingText="Opening Stripe…">Billing history</SubmitButton></form>
                  )}
                </>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How billing works</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm">
                {[
                  ["Only doctors are seats.", "Admins and secretaries are free."],
                  ["Seats follow your team.", "Adding or removing a doctor is prorated automatically."],
                  ["No lock-in.", "Cancel any time from Manage billing."],
                  ["Payments by Stripe.", "Cards, invoices and receipts are handled securely by Stripe."],
                ].map(([b, t]) => (
                  <li key={b} className="flex gap-2">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span><span className="font-medium">{b}</span> <span className="text-muted-foreground">{t}</span></span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
