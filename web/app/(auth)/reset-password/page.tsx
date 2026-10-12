"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// User lands here from the password-reset email after Supabase exchanges
// the recovery code (via the PASSWORD_RECOVERY auth event in the
// callback handler). They're temporarily authenticated and may set a
// new password via updateUser.
export default function ResetPasswordPage() {
  const sb = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) { setMsg("Password must be at least 8 chars."); return; }
    if (password !== confirm) { setMsg("Passwords don't match."); return; }
    setBusy(true);
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Password updated. Redirecting…");
      setTimeout(() => { router.push("/"); router.refresh(); }, 800);
    } catch (err: any) { setMsg(err.message); }
    finally { setBusy(false); }
  };

  const ok = msg?.startsWith("Password updated");

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="mark">C</span>
          <span className="wordmark">Clinic</span>
        </div>
        <h2>Set a new password</h2>
        {!ready && <p className="sub">Verifying reset link…</p>}
        {ready && (
          <>
            <p className="sub">Choose a strong password you haven&apos;t used before.</p>
            <form onSubmit={submit}>
              <div className="field">
                <Label htmlFor="pw">New password</Label>
                <Input
                  id="pw"
                  type="password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required />
              </div>
              <div className="field">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input
                  id="pw2"
                  type="password"
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required />
              </div>
              <Button type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy ? <span className="spinner" /> : "Update password"}
              </Button>
            </form>
          </>
        )}
        {msg && (
          <p style={{ marginTop: 14, fontSize: 13, textAlign: "center", color: ok ? "var(--success)" : "var(--danger)" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
