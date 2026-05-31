"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const sb = createClient();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg("If that email exists, a reset link has been sent.");
    } catch (err: any) { setMsg(err.message); }
    finally { setBusy(false); }
  };

  const ok = msg?.includes("sent");

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="mark">C</span>
          <span className="wordmark">Clinic</span>
        </div>
        <h2>Reset password</h2>
        <p className="sub">Enter your email and we&apos;ll send you a reset link.</p>

        <form onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email"
                   value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "…" : "Send reset link"}
          </button>
        </form>

        <p className="auth-foot"><a className="link" href="/login">Back to sign in</a></p>
        {msg && (
          <p style={{ marginTop: 14, fontSize: 13, textAlign: "center", color: ok ? "var(--success)" : "var(--danger)" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
