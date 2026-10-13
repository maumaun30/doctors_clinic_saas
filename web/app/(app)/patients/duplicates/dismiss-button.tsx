"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dismissDuplicate } from "@/lib/actions/patients";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** "Not the same person": hide this pair from the suggestions. */
export function DismissButton({ a, b }: { a: string; b: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => start(async () => {
      const res = await dismissDuplicate(a, b);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Marked as different people");
      router.refresh();
    })}>
      {pending && <Spinner />} Not the same person
    </Button>
  );
}
