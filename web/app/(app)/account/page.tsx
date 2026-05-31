"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { updateMyProfile } from "@/lib/actions/profile";
import { ProviderLogo } from "@/app/_components/brand-icons";

type Provider = "google" | "apple" | "facebook";
const ALL: Provider[] = ["google", "apple", "facebook"];

export default function AccountPage() {
  const sb = createClient();
  const router = useRouter();
  const [identities, setIdentities] = useState<{ provider: string; id: string }[]>([]);
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const { data, error } = await sb.auth.getUserIdentities();
    if (error) { setMsg(error.message); return; }
    setIdentities(data.identities ?? []);
    const { data: u } = await sb.auth.getUser();
    setEmail(u.user?.email ?? "");
    if (u.user) {
      const { data: p } = await sb.from("profiles")
        .select("full_name, phone").eq("id", u.user.id).single();
      setFullName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");
    }
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await updateMyProfile({ full_name: fullName, phone: phone || null });
      setMsg("Profile saved.");
    } catch (err: any) { setMsg(err.message); }
  };
  useEffect(() => { refresh(); }, []);

  const link = async (provider: Provider) => {
    setMsg(null);
    const { error } = await sb.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg(error.message);
  };

  const unlink = async (identity: { provider: string; id: string }) => {
    if (identities.length <= 1) {
      setMsg("Cannot unlink your only sign-in method.");
      return;
    }
    setMsg(null);
    // @ts-expect-error supabase-js accepts the identity object
    const { error } = await sb.auth.unlinkIdentity(identity);
    if (error) setMsg(error.message); else refresh();
  };

  const signOut = async () => {
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const linkedProviders = new Set(identities.map(i => i.provider));
  const ok = msg === "Profile saved.";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <div className="sub">Signed in as {email || "…"}</div>
        </div>
      </div>

      <div className="stack">
        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Profile</div>
          <form onSubmit={saveProfile} style={{ maxWidth: 420 }}>
            <div className="field">
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary">Save profile</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Sign-in methods</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {identities.length === 0
              ? <span className="hint">Loading…</span>
              : identities.map(i => (
                <span key={i.id} className="badge">
                  {i.provider === "email" ? <span className="dot" /> : <ProviderLogo provider={i.provider} size={13} />}
                  {i.provider}
                  {i.provider !== "email" && (
                    <button onClick={() => unlink(i)} title="Unlink"
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-subtle)", padding: 0, marginLeft: 2 }}>✕</button>
                  )}
                </span>
              ))}
          </div>
          <p className="hint" style={{ marginBottom: 10 }}>
            Linking requires <strong>Manual Linking</strong> enabled in Supabase Auth settings.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ALL.map(p => (
              <button key={p} className="btn btn-secondary btn-sm" disabled={linkedProviders.has(p)} onClick={() => link(p)}>
                <ProviderLogo provider={p} size={15} />
                {linkedProviders.has(p) ? `${p} ✓` : `Link ${p}`}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Session</div>
          <button onClick={signOut} className="btn btn-secondary">Sign out</button>
        </div>

        {msg && (
          <p style={{ fontSize: 13, color: ok ? "var(--success)" : "var(--danger)" }}>{msg}</p>
        )}
      </div>
    </>
  );
}
