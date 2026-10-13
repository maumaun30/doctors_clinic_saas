"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecksIcon, XIcon } from "lucide-react";
import { setSetupChecklistHidden } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Hide the setup checklist (on Today) or bring it back (from Help). */
export function ChecklistToggle({ hide }: { hide: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant={hide ? "ghost" : "outline"} size="sm" disabled={pending} onClick={() => start(async () => {
      const res = await setSetupChecklistHidden(hide);
      if (!res.ok) { toast.error(res.error); return; }
      if (hide) { toast.success("Checklist hidden. Bring it back from Help."); router.refresh(); }
      else router.push("/today");
    })}>
      {pending ? <Spinner /> : hide ? <XIcon /> : <ListChecksIcon />} {hide ? "Hide" : "Show on Today"}
    </Button>
  );
}
