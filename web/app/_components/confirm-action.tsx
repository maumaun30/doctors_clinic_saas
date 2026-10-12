"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// A destructive button that asks first. On confirm it calls the server
// action with `fields` as FormData, then toasts the outcome. Failures
// toast `error` instead of throwing to the error page — production builds
// hide thrown server-action messages, so pass a message that explains
// the likely cause.
//
// Renders a type="button" trigger, so it is safe inside another <form>.
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  description,
  confirmLabel = label,
  success,
  error = "Something went wrong. Please try again.",
  className = "btn btn-ghost btn-sm",
  danger = true,
  triggerTitle,
}: {
  action: (formData: FormData) => Promise<unknown>;
  fields: Record<string, string>;
  label: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: React.ReactNode;
  success?: string;
  error?: string;
  className?: string;
  danger?: boolean;
  triggerTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (e: React.MouseEvent) => {
    // Keep the dialog open (and its button busy) until the action settles.
    e.preventDefault();
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
        if (success) toast.success(success);
      } catch {
        setOpen(false);
        toast.error(error);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={o => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={className}
          style={danger ? { color: "var(--danger)" } : undefined}
          title={triggerTitle}
        >
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={run}
            disabled={pending}
            className={danger ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
