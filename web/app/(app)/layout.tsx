import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { getMyClinics, getActiveClinicId } from "@/lib/data/clinic-context";
import { signOut } from "@/lib/actions/auth";
import { AppShell, type NavGroup } from "@/app/_components/app-shell";
import { phYmd } from "@/lib/dates";
import { ClinicSwitcher } from "@/app/_components/clinic-switcher";
import { UserMenu, type UserMenuLink } from "@/app/_components/user-menu";

import { SentryUser } from "@/app/_components/sentry-user";
import * as Sentry from "@sentry/nextjs";
import { syncSeats } from "@/lib/billing";
import { hasTwoFactorSession } from "@/lib/auth/mfa";

import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const profile = await getMyProfile(sb);
  if (!profile) redirect("/login");
  // Admins must finish two-factor before using the app (set up on first visit).
  if (profile.role === "admin" && !(await hasTwoFactorSession(sb))) redirect("/mfa");

  // Server-side errors for this request carry an opaque id + role only.
  Sentry.setUser({ id: profile.id });
  Sentry.setTag("role", profile.role);
  // A pending user with an open invite for their verified email gets their
  // role on first load — no admin approval step needed.
  if (profile.role === "pending" || !profile.account_id) {
    const { data: accepted } = await sb.rpc("accept_pending_invite");
    if (accepted?.[0]) {
      if (accepted[0].role === "doctor") await syncSeats(accepted[0].account_id);
      redirect("/");
    }
  }

  const isPending = profile.role === "pending" || !profile.account_id;
  const isAdmin = profile.role === "admin";
  const isDoctor = profile.role === "doctor";

  const clinics = isPending ? [] : await getMyClinics(sb);
  const activeClinic = isPending ? null : await getActiveClinicId(sb);

  // Live badges: appointments still to see today, and people waiting for
  // access (admins). Kept cheap: head counts only.
  let todayLeft = 0;
  let awaiting = 0;
  if (!isPending) {
    const today = phYmd();
    let tq = sb.from("appointments").select("id", { count: "exact", head: true })
      .gte("scheduled_at", `${today}T00:00:00+08:00`).lte("scheduled_at", `${today}T23:59:59+08:00`)
      .in("status", ["scheduled", "confirmed"]);
    if (activeClinic) tq = tq.eq("clinic_id", activeClinic);
    if (isDoctor) tq = tq.eq("doctor_id", profile.id);
    const [{ count }, pendingRes, invitesRes] = await Promise.all([
      tq,
      isAdmin ? sb.rpc("list_pending_users") : Promise.resolve({ data: [] as { email: string | null }[] }),
      isAdmin ? sb.from("staff_invites").select("email").is("accepted_at", null).is("revoked_at", null)
        : Promise.resolve({ data: [] as { email: string }[] }),
    ]);
    todayLeft = count ?? 0;
    const invited = new Set((invitesRes.data ?? []).map(i => i.email));
    awaiting = ((pendingRes.data ?? []) as { email: string | null }[])
      .filter(u => !invited.has(String(u.email ?? "").toLowerCase())).length;
  }

  const groups: NavGroup[] = isPending ? [] : [
    { label: null, links: [
      { href: "/today", label: "Today", icon: "today", count: todayLeft },
      { href: "/schedule", label: "Schedule", icon: "schedule" },
      { href: "/patients", label: "Patients", icon: "patients" },
      { href: "/availability", label: "Availability", icon: "availability" },
      { href: "/analytics", label: "Analytics", icon: "analytics" },
    ] },
    ...(isAdmin ? [
      { label: "Team", links: [
        { href: "/admin/doctors", label: "Doctors", icon: "doctors" as const },
        { href: "/admin/secretaries", label: "Secretaries", icon: "secretaries" as const },
        { href: "/admin/users", label: "Team & invites", icon: "team" as const, count: awaiting },
      ] },
      { label: "Settings", links: [
        { href: "/admin/clinics", label: "Clinics", icon: "clinics" as const },
        { href: "/admin/library", label: "Library", icon: "library" as const },
        { href: "/admin/billing", label: "Billing", icon: "billing" as const },
        { href: "/admin/audit", label: "Audit log", icon: "audit" as const },
      ] },
    ] : []),
  ];

  const name = profile.full_name ?? "User";

  // Trial / read-only banner. Shown to everyone when writes are blocked,
  // and to admins in the last 3 days of the free trial.
  const billing = isPending ? null : (await sb.rpc("my_billing_status")).data?.[0];
  const trialDaysLeft = billing
    ? Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / 86_400_000)
    : null;
  const subscribed = ["active", "trialing", "past_due"].includes(billing?.subscription_status ?? "");
  const banner = !billing ? null
    : !billing.is_active ? (
      <div className="billing-banner billing-banner-danger" role="alert">
        Read-only: this account’s subscription isn’t active, so nothing can be added or changed.
        {isAdmin ? <> <Link href="/admin/billing" className="link">Subscribe</Link></> : " Ask an admin to subscribe."}
      </div>
    )
    : isAdmin && !subscribed && trialDaysLeft !== null && trialDaysLeft <= 3 ? (
      <div className="billing-banner" role="status">
        Free trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}. <Link href="/admin/billing" className="link">Subscribe</Link>
      </div>
    )
    : billing.subscription_status === "past_due" && isAdmin ? (
      <div className="billing-banner billing-banner-danger" role="alert">
        Payment failed — Stripe is retrying. <Link href="/admin/billing" className="link">Update your card</Link>
      </div>
    )
    : null;

  const switcher = isPending ? (
    <div className="switcher">
      <span className="mark">·</span>
      <span className="meta">
        <span className="name">Pending access</span>
        <span className="sub">Awaiting approval</span>
      </span>
    </div>
  ) : (
    <ClinicSwitcher clinics={clinics} activeClinic={activeClinic} isAdmin={isAdmin} />
  );

  const { data: { user } } = await sb.auth.getUser();
  const menuLinks: UserMenuLink[] = [
    { href: "/account", label: "Account settings", icon: "user" },
    ...(isAdmin ? [{ href: "/admin/billing", label: "Billing", icon: "card" as const }] : []),
  ];
  const footer = (
    <UserMenu
      name={name}
      email={user?.email ?? null}
      role={isPending ? "Pending" : profile.role}
      links={menuLinks}
      signOut={signOut}
    />
  );

  return (
    <AppShell switcher={switcher} groups={groups} footer={footer}>
      <SentryUser id={profile.id} role={profile.role} />
      {banner}
      {children}
    </AppShell>
  );
}
