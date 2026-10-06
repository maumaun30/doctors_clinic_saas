import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { getMyClinics, getActiveClinicId } from "@/lib/data/clinic-context";
import { signOut } from "@/lib/actions/auth";
import { AppShell, type NavLink } from "@/app/_components/app-shell";
import { ClinicSwitcher } from "@/app/_components/clinic-switcher";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Icon } from "@/app/_components/icons";
import Link from "next/link";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const profile = await getMyProfile(sb);
  if (!profile) redirect("/login");

  const isPending = profile.role === "pending" || !profile.account_id;
  const isAdmin = profile.role === "admin";
  const isDoctor = profile.role === "doctor";

  const clinics = isPending ? [] : await getMyClinics(sb);
  const activeClinic = isPending ? null : await getActiveClinicId(sb);

  const nav: NavLink[] = isPending
    ? []
    : [
        { href: "/today", label: "Today", icon: "today" },
        { href: "/schedule", label: "Schedule", icon: "calendar" },
        { href: "/patients", label: "Patients", icon: "users" },
        { href: "/analytics", label: "Analytics", icon: "chart" },
        ...(isDoctor || isAdmin
          ? [{ href: "/availability", label: "Availability", icon: "clock" as const }]
          : []),
        { href: "/account", label: "Account", icon: "settings" },
      ];

  const adminNav: NavLink[] =
    isAdmin && !isPending
      ? [
          { href: "/admin/clinics", label: "Clinics", icon: "building" },
          { href: "/admin/doctors", label: "Doctors", icon: "user" },
          { href: "/admin/secretaries", label: "Secretaries", icon: "users" },
          { href: "/admin/assignments", label: "Assignments", icon: "shield" },
          { href: "/admin/library", label: "Library", icon: "settings" },
          { href: "/admin/users", label: "Pending users", icon: "user" },
          { href: "/admin/audit", label: "Audit log", icon: "shield" },
          { href: "/admin/billing", label: "Billing", icon: "card" },
        ]
      : [];

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

  const footer = (
    <>
      <div className="user-row">
        <span className="avatar">{initials(name)}</span>
        <span className="meta">
          <span className="name">{name}</span>
        </span>
      </div>
      <div className="footer-actions">
        <ThemeToggle />
        <form action={signOut} style={{ flex: 1 }}>
          <button type="submit" className="btn btn-secondary btn-sm" style={{ width: "100%" }} title="Sign out">
            <Icon name="logout" />
            <span className="btn-label">Sign out</span>
          </button>
        </form>
      </div>
    </>
  );

  return (
    <AppShell switcher={switcher} nav={nav} adminNav={adminNav} footer={footer}>
      {banner}
      {children}
    </AppShell>
  );
}
