"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { GoogleLogo } from "@/app/_components/brand-icons";
import { Button } from "@/components/ui/button";

// Apple + Facebook OAuth removed for now (testing). To re-enable: add the
// provider here, re-add its button below, and import {AppleLogo, FacebookLogo}.
type Provider = "google";
type Mode = "signin" | "signup";

export default function LoginPage() {
  const sb = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // /auth/confirm sends people here when an email link is expired or used.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "link_invalid") {
      setMsg("That link is invalid or has expired. Sign in below, or ask your admin to resend the invite.");
    }
  }, []);

  const oauth = async (provider: Provider) => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { error } = await sb.auth.signUp({
          email, password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMsg("Check your email to confirm your account.");
      }
    } catch (err: any) { setMsg(err.message); }
    finally { setBusy(false); }
  };

  const ok = msg?.toLowerCase().includes("check");

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="mark">C</span>
          <span className="wordmark">Clinic</span>
        </div>
        <h2>{mode === "signin" ? "Sign in" : "Create account"}</h2>
        <p className="sub">
          {mode === "signin"
            ? "Welcome back. Enter your credentials to continue."
            : "Set up your account to get started."}
        </p>

        <form onSubmit={submitEmail}>
          {mode === "signup" && (
            <div className="field">
              <label className="label" htmlFor="full_name">Full name</label>
              <input id="full_name" className="input" value={fullName}
                     onChange={e => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email"
                   value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <label className="label" htmlFor="pw" style={{ margin: 0 }}>Password</label>
              {mode === "signin" && (
                <a className="link" href="/forgot-password" style={{ fontSize: 12.5 }}>Forgot?</a>
              )}
            </div>
            <input id="pw" className="input" type="password" minLength={8}
                   autoComplete={mode === "signin" ? "current-password" : "new-password"}
                   value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? <span className="spinner" /> : mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "var(--fg-subtle)", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          or continue with
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Button variant="outline" type="button" onClick={() => oauth("google")}><GoogleLogo /> Google</Button>
        </div>

        <p className="auth-foot">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <a className="link" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </a>
        </p>

        {msg && (
          <p style={{ marginTop: 14, fontSize: 13, textAlign: "center", color: ok ? "var(--success)" : "var(--danger)" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
