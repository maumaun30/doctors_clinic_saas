"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { GoogleLogo } from "@/app/_components/brand-icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon, EyeIcon, EyeOffIcon } from "lucide-react";

// Supabase auth messages, in plain language.
const friendly = (m: string) =>
  /invalid login credentials/i.test(m) ? "Email or password is incorrect."
  : /email not confirmed/i.test(m) ? "Confirm your email first — check your inbox for the link."
  : /user already registered/i.test(m) ? "That email already has an account. Sign in instead."
  : /password should be at least/i.test(m) ? "Use a password of at least 8 characters."
  : /rate limit|too many/i.test(m) ? "Too many attempts. Wait a minute and try again."
  : m;

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
  const [oauthBusy, setOauthBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // /auth/confirm sends people here when an email link is expired or used.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "link_invalid") {
      setMsg("That link is invalid or has expired. Sign in below, or ask your admin to resend the invite.");
    }
  }, []);

  const oauth = async (provider: Provider) => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    setOauthBusy(true);
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) { setMsg(friendly(error.message)); setOauthBusy(false); }
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
    } catch (err: any) { setMsg(friendly(err.message)); }
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

        {msg && (
          <Alert variant={ok ? "default" : "destructive"}
            className={ok ? "mb-4 border-(--success)/30 bg-(--success-subtle) text-(--success)" : "mb-4 border-destructive/30 bg-destructive/5"}>
            {ok ? <CheckCircle2Icon /> : <AlertCircleIcon />}
            <AlertDescription className={ok ? "text-(--success)" : undefined}>{msg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={submitEmail}>
          {mode === "signup" && (
            <div className="field">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required />
            </div>
          )}
          <div className="field">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required />
          </div>
          <div className="field">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <Label htmlFor="pw" style={{ margin: 0 }}>Password</Label>
              {mode === "signin" && (
                <a className="link" href="/forgot-password" style={{ fontSize: 12.5 }}>Forgot?</a>
              )}
            </div>
            <div className="relative">
              <Input
                id="pw"
                type={showPw ? "text" : "password"}
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pr-9"
                required />
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setShowPw(v => !v)}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}>
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
            {mode === "signup" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
          </div>
          <Button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? <><Spinner /> {mode === "signin" ? "Signing in…" : "Creating account…"}</> : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "var(--fg-subtle)", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          or continue with
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <Button variant="outline" type="button" disabled={oauthBusy} onClick={() => oauth("google")}>
            {oauthBusy ? <Spinner /> : <GoogleLogo />} Google
          </Button>
        </div>

        <p className="auth-foot">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button type="button" className="link" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

      </div>
    </div>
  );
}
