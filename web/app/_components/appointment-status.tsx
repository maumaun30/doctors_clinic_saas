import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS: Record<string, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: "secondary",   label: "Scheduled" },
  confirmed: { variant: "info",        label: "Confirmed" },
  completed: { variant: "success",     label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  no_show:   { variant: "destructive", label: "No-show" },
};

/**
 * Colored badge for an appointment status (with a leading dot). Pass the
 * appointment's patient_response to mark ones the patient confirmed or
 * cancelled from their reminder link.
 */
export function AppointmentStatusBadge({ status, patientResponse }: { status: string; patientResponse?: string | null }) {
  const s = STATUS[status] ?? { variant: "secondary" as const, label: status };
  const byPatient = patientResponse != null && patientResponse === status;
  return (
    <Badge variant={s.variant} title={byPatient ? `${s.label} by the patient from their reminder link` : undefined}>
      <span className="dot" />{s.label}{byPatient && " by patient"}
    </Badge>
  );
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
