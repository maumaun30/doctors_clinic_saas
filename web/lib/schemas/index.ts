import { z } from "zod";

export const userRole = z.enum(["pending", "admin", "doctor", "secretary"]);
export type UserRole = z.infer<typeof userRole>;

export const sex = z.enum(["male", "female", "other"]);

export const appointmentStatus = z.enum([
  "scheduled", "confirmed", "completed", "cancelled", "no_show",
]);

export const uuid = z.string().uuid();

export const clinicInput = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const clinicBookingInput = z.object({
  online_booking: z.boolean(),
  booking_slug: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes")
    .min(3).max(60)
    .nullable(),
}).refine(v => !v.online_booking || v.booking_slug, {
  message: "Set a booking link before turning online booking on",
});

export const patientInput = z.object({
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string().date().optional(),
  sex: sex.optional(),
  phone: z.string().max(40).optional(),
  email: z.string().trim().email().max(254).optional(),
  address: z.string().max(500).optional(),
});

export const bookAppointmentInput = z.object({
  patient_id: uuid,
  doctor_id: uuid,
  clinic_id: uuid,
  scheduled_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().positive().max(480).default(30),
  notes: z.string().max(2000).optional(),
});

export const completeAppointmentInput = z.object({
  appointment_id: uuid,
  chief_complaint: z.string().max(2000).optional(),
  diagnosis: z.string().max(2000).optional(),
  vitals: z.record(z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
});

export const setStatusInput = z.object({
  appointment_id: uuid,
  status: z.enum(["scheduled", "confirmed", "cancelled", "no_show"]),
});

export const rescheduleInput = z.object({
  appointment_id: uuid,
  scheduled_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().positive().max(480).optional(),
});

export const assignUserInput = z.object({
  user_id: uuid,
  role: z.enum(["admin", "doctor", "secretary"]),
});
