"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Factor = { id: string; friendly_name?: string | null; created_at: string };

/** Account settings: authenticator status. Required for admins, optional for others. */
export function TwoFactorSettings({ isAdmin }: { isAdmin: boolean }) {
  const sb = useMemo(() => createClient(), []);
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await sb.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).filter(f => f.status === "verified"));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const turnOff = async () => {
    if (!factors?.length) return;
    setBusy(true);
    for (const f of factors) {
      const { error } = await sb.auth.mfa.unenroll({ factorId: f.id });
      if (error) {
        toast.error(/aal2|assurance/i.test(error.message)
          ? "Verify with your authenticator first (sign out and back in), then try again."
          : "Couldn’t turn off two-factor. Please try again.");
        setBusy(false);
        return;
      }
    }
    await sb.auth.refreshSession();
    toast.success("Two-factor authentication turned off");
    setBusy(false);
    load();
  };

  if (factors === null) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>;
  const on = factors.length > 0;
  const since = on ? new Date(factors[0].created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-full ${on ? "bg-(--success-subtle) text-(--success)" : "bg-muted text-muted-foreground"}`}>
          {on ? <ShieldCheckIcon className="size-4" /> : <ShieldOffIcon className="size-4" />}
        </span>
        <div className="grid">
          <span className="flex items-center gap-2 text-sm font-medium">
            Authenticator app {on ? <Badge variant="success">On</Badge> : <Badge variant="secondary">Off</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">
            {on ? `Added ${since}. You’ll enter a code from your phone when you sign in.`
              : isAdmin ? "Required for admin accounts." : "Adds a code from your phone at sign-in."}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/mfa?setup=1&next=/account">{on ? "Replace authenticator" : "Set up"}</Link>
        </Button>
        {on && !isAdmin && (
          <Button variant="ghost" size="sm" onClick={turnOff} disabled={busy} className="text-destructive hover:text-destructive">
            {busy ? <Spinner /> : null} Turn off
          </Button>
        )}
      </div>
    </div>
  );
}
