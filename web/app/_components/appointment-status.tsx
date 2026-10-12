import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS: Record<string, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: "secondary",   label: "Scheduled" },
  confirmed: { variant: "info",        label: "Confirmed" },
  completed: { variant: "success",     label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  no_show:   { variant: "destructive", label: "No-show" },
};

/** Colored badge for an appointment status (with a leading dot). */
export function AppointmentStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={s.variant}><span className="dot" />{s.label}</Badge>;
}

const LAB: Record<string, { variant: BadgeVariant; label: string }> = {
  ordered:     { variant: "secondary",   label: "Ordered" },
  in_progress: { variant: "info",        label: "In progress" },
  completed:   { variant: "success",     label: "Completed" },
  cancelled:   { variant: "destructive", label: "Cancelled" },
};

/** Colored badge for a lab order status. */
export function LabStatusBadge({ status }: { status: string }) {
  const s = LAB[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
