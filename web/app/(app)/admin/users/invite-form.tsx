"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteStaff, type InviteResult } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteStaff, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);

  return (
    <form ref={formRef} action={action}>
      <div className="grid-2">
        <div className="field">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="name@clinic.ph" />
        </div>
        <div className="field">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect id="invite-role" name="role" defaultValue="secretary" className="w-full">
            <NativeSelectOption value="secretary">Secretary — books & manages appointments</NativeSelectOption>
            <NativeSelectOption value="doctor">Doctor — visits & records (adds a billing seat)</NativeSelectOption>
            <NativeSelectOption value="admin">Admin — full access incl. billing</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="settings-actions">
        {state && (
          <p role={state.ok ? "status" : "alert"}
             style={{ fontSize: 13, margin: 0, color: state.ok ? "var(--success)" : "var(--danger)" }}>
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
