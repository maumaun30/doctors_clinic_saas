"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Mode = "loading" | "verify" | "enroll";

// Two-factor step. Admins land here until their session is aal2:
// with an authenticator already set up they enter a code; otherwise they
// scan a QR code once to set one up. Other users can come here from
// Account settings to turn 2FA on.
export default function MfaPage() {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const next = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/today";
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      const setup = new URLSearchParams(window.location.search).has("setup");
      if (aal?.currentLevel === "aal2" && !setup) { router.replace(next()); return; }

      const { data: factors, error: fErr } = await sb.auth.mfa.listFactors();
      if (fErr) { setError("Couldn’t load your security settings. Refresh to try again."); return; }
      const verified = factors.totp.find(f => f.status === "verified");
      if (verified && !setup) { setFactorId(verified.id); setMode("verify"); return; }

      // Drop abandoned setups before starting a new one.
      for (const f of factors.all.filter(f => f.factor_type === "totp" && f.status !== "verified")) {
        await sb.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
      if (error) {
        setError(/not enabled|disabled/i.test(error.message)
          ? "Two-factor authentication isn’t enabled for this project yet. Ask your administrator."
          : "Couldn’t start setup. Refresh to try again.");
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setMode("enroll");
    })();
  }, [sb, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    if (error) {
      setBusy(false);
      setCode("");
      setError(/invalid|expired/i.test(error.message) ? "That code didn’t match. Check the time on your phone and try the newest code." : error.message);
      return;
    }
    router.replace(next());
    router.refresh();
  };

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="mark">C</span>
          <span className="wordmark">Clinic</span>
        </div>
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {mode === "enroll" ? <SmartphoneIcon className="size-5" /> : <ShieldCheckIcon className="size-5" />}
        </div>
        <h2>{mode === "enroll" ? "Set up two-factor authentication" : "Two-factor authentication"}</h2>
        <p className="sub">
          {mode === "enroll"
            ? "Admin accounts protect patient records and billing, so they need a second step at sign-in. Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…)."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        {mode === "loading" && !error && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>
        )}

        {mode === "enroll" && qr && (
          <div className="mb-4 grid justify-items-center gap-3">
            {/* Supabase returns the QR code as an SVG data URL. */}
            <img src={qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg border bg-white p-2" />
            {secret && (
              <details className="w-full text-center text-xs text-muted-foreground">
                <summary className="cursor-pointer">Can’t scan? Enter this key instead</summary>
                <code className="mt-2 block rounded-md bg-muted px-2 py-1.5 font-mono text-[13px] tracking-wider break-all text-foreground select-all">{secret}</code>
              </details>
            )}
          </div>
        )}

        {(mode === "verify" || mode === "enroll") && (
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="code">{mode === "enroll" ? "Then enter the 6-digit code it shows" : "Authentication code"}</Label>
              <Input id="code" value={code} onChange={e => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
                inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" autoFocus required
                className="text-center font-mono text-lg tracking-[0.3em]" />
            </div>
            <Button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6} className="w-full">
              {busy ? <><Spinner /> Verifying…</> : mode === "enroll" ? "Turn on two-factor" : "Verify"}
            </Button>
          </form>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4 border-destructive/30 bg-destructive/5">
            <AlertCircleIcon /><AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form action={signOut} className="auth-foot">
          <button type="submit" className="link">Sign out</button>
        </form>
      </div>
    </div>
  );
}
