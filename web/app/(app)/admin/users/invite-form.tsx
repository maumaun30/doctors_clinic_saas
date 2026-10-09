"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteStaff, type InviteResult } from "@/lib/actions/invites";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteStaff, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form ref={formRef} action={action}>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="invite-email">Email</label>
          <input id="invite-email" className="input" name="email" type="email" required
                 autoComplete="off" placeholder="name@clinic.ph" />
        </div>
        <div className="field">
          <label className="label" htmlFor="invite-role">Role</label>
          <select id="invite-role" className="select" name="role" defaultValue="secretary" style={{ width: "100%" }}>
            <option value="secretary">Secretary — books & manages appointments</option>
            <option value="doctor">Doctor — visits & records (adds a billing seat)</option>
            <option value="admin">Admin — full access incl. billing</option>
          </select>
        </div>
      </div>
      <div className="settings-actions">
        {state && (
          <p role={state.ok ? "status" : "alert"}
             style={{ fontSize: 13, margin: 0, color: state.ok ? "var(--success)" : "var(--danger)" }}>
            {state.message}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </form>
  );
}
