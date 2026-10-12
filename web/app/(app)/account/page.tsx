"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { updateMyProfile } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";
import { ProviderLogo } from "@/app/_components/brand-icons";
import { Skeleton } from "@/app/_components/skeleton";
import { ThemeToggle } from "@/app/_components/theme-toggle";
import { Icon } from "@/app/_components/icons";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TwoFactorSettings } from "./two-factor";

// Apple + Facebook OAuth removed for now (testing). To re-enable, add the
// provider back to this list — the ProviderLogo + link/unlink code already
// handles any provider generically.
type Provider = "google";
const ALL: Provider[] = ["google"];
const PROVIDER_LABEL: Record<string, string> = { email: "Email & password", google: "Google" };

type Identity = { provider: string; id: string; identity_data?: { email?: string } };
type Status = { kind: "ok" | "error"; text: string } | null;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "U";
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p role={status.kind === "error" ? "alert" : "status"}
       style={{ fontSize: 13, margin: 0, color: status.kind === "ok" ? "var(--success)" : "var(--danger)" }}>
      {status.text}
    </p>
  );
}

export default function AccountPage() {
  const sb = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [saved, setSaved] = useState({ full_name: "", phone: "" });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<Status>(null);
  const [signInStatus, setSignInStatus] = useState<Status>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  async function refresh() {
    const [{ data: ids, error }, { data: u }] = await Promise.all([
      sb.auth.getUserIdentities(),
      sb.auth.getUser(),
    ]);
    if (error) setSignInStatus({ kind: "error", text: error.message });
    setIdentities((ids?.identities ?? []) as Identity[]);
    setEmail(u.user?.email ?? "");
    if (u.user) {
      const { data: p } = await sb.from("profiles")
        .select("full_name, phone, role").eq("id", u.user.id).single();
      const next = { full_name: p?.full_name ?? "", phone: p?.phone ?? "" };
      setSaved(next);
      setFullName(next.full_name);
      setPhone(next.phone);
      setRole(p?.role ?? "");
    }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const dirty = fullName.trim() !== saved.full_name || phone.trim() !== saved.phone;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);
    setSaving(true);
    try {
      await updateMyProfile({ full_name: fullName.trim(), phone: phone.trim() || null });
      setSaved({ full_name: fullName.trim(), phone: phone.trim() });
      setProfileStatus({ kind: "ok", text: "Profile saved." });
      router.refresh(); // sidebar shows the name
    } catch (err: any) {
      setProfileStatus({ kind: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const link = async (provider: Provider) => {
    setSignInStatus(null);
    setBusyProvider(provider);
    const { error } = await sb.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setSignInStatus({ kind: "error", text: error.message }); setBusyProvider(null); }
  };

  const unlink = async (identity: Identity) => {
    if (identities.length <= 1) return;
    setSignInStatus(null);
    setBusyProvider(identity.provider);
    // @ts-expect-error supabase-js accepts the identity object
    const { error } = await sb.auth.unlinkIdentity(identity);
    setBusyProvider(null);
    if (error) setSignInStatus({ kind: "error", text: error.message });
    else { setSignInStatus({ kind: "ok", text: `${PROVIDER_LABEL[identity.provider] ?? identity.provider} disconnected.` }); refresh(); }
  };

  const sendPasswordReset = async () => {
    setSignInStatus(null);
    setBusyProvider("email");
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusyProvider(null);
    setSignInStatus(error
      ? { kind: "error", text: error.message }
      : { kind: "ok", text: `We sent a password reset link to ${email}.` });
  };

  if (loading) {
    return (
      <div role="status" aria-label="Loading" className="skeleton-page">
        <div className="page-head">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Skeleton w={48} h={48} r={999} />
            <div>
              <Skeleton w={160} h={22} />
              <Skeleton w={220} h={13} style={{ marginTop: 8 }} />
            </div>
          </div>
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} className="settings-section">
            <div className="settings-intro">
              <Skeleton w={110} h={15} />
              <Skeleton w="90%" h={12} style={{ marginTop: 10 }} />
              <Skeleton w="70%" h={12} style={{ marginTop: 6 }} />
            </div>
            <div className="card settings-card">
              <Skeleton w="100%" h={36} r={8} />
              <Skeleton w="100%" h={36} r={8} style={{ marginTop: 12 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const identityFor = (p: string) => identities.find(i => i.provider === p);
  const hasEmail = Boolean(identityFor("email"));
  const providers = ["email", ...ALL] as const;
  const name = saved.full_name || email || "Your account";

  return (
    <>
      <PageHeader
        leading={<span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(name)}</span>}
        title={name}
        sub={<span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {email}
          {role && <Badge variant="secondary" style={{ textTransform: "capitalize" }}>{role}</Badge>}
        </span>}
      />

      <Section title="Profile" description="Your name appears on visits, prescriptions and the audit log.">
        <form onSubmit={saveProfile}>
          <div className="field">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              autoComplete="name"
              onChange={e => setFullName(e.target.value)}
              required />
          </div>
          <div className="grid-2">
            <div className="field">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                autoComplete="tel"
                onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} readOnly aria-describedby="email-hint" />
              <span id="email-hint" className="hint">Used to sign in. Can’t be changed here.</span>
            </div>
          </div>
          <div className="settings-actions">
            <StatusLine status={profileStatus} />
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Sign-in methods" description="Ways you can sign in to this account. Keep at least one connected.">
        <div className="settings-list">
          {providers.map(p => {
            const identity = identityFor(p);
            const busy = busyProvider === p;
            return (
              <div key={p} className="settings-list-row">
                <span className="settings-list-icon">
                  {p === "email" ? <Icon name="user" /> : <ProviderLogo provider={p} size={18} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="strong" style={{ display: "block" }}>{PROVIDER_LABEL[p] ?? p}</span>
                  <span className="hint">
                    {identity
                      ? identity.identity_data?.email ?? "Connected"
                      : "Not connected"}
                  </span>
                </span>
                {p === "email" ? (
                  hasEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={busy}
                      onClick={sendPasswordReset}>
                      {busy ? "Sending…" : "Change password"}
                    </Button>
                  )
                ) : identity ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={busy || identities.length <= 1}
                    title={identities.length <= 1 ? "You can’t remove your only sign-in method" : undefined}
                    onClick={() => unlink(identity)}>
                    {busy ? "Disconnecting…" : "Disconnect"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => link(p)}>
                    {busy ? "Redirecting…" : "Connect"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <div className="settings-actions" style={{ justifyContent: "flex-start" }}>
          <StatusLine status={signInStatus} />
        </div>
      </Section>

      <Section title="Two-factor authentication"
        description={role === "admin"
          ? "Admins must confirm sign-in with a code from an authenticator app."
          : "Optional extra protection: a code from your phone at sign-in."}>
        <TwoFactorSettings isAdmin={role === "admin"} />
      </Section>

      <Section title="Appearance" description="Choose light or dark. Saved on this device.">
        <div className="row-between">
          <span>Theme</span>
          <ThemeToggle />
        </div>
      </Section>

      <Section title="Session" description="Sign out of this browser.">
        <form action={signOut}>
          <Button variant="outline" type="submit">
            <Icon name="logout" /> Sign out
          </Button>
        </form>
      </Section>
    </>
  );
}
