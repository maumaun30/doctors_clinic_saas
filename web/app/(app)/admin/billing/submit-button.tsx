"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Form submit button that shows a spinner while the Stripe redirect loads. */
export function SubmitButton({ children, pendingText, variant }: {
  children: React.ReactNode; pendingText: string; variant?: "default" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? <><Spinner /> {pendingText}</> : children}
    </Button>
  );
}
