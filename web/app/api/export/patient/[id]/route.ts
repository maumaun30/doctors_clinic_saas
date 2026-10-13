import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { hasTwoFactorSession } from "@/lib/auth/mfa";
import { auditPatientExport, loadPatientRecord } from "@/lib/export/patient";

export const dynamic = "force-dynamic";

/** One patient's record as JSON (data portability). Doctors and admins. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Unknown patient." }, { status: 404 });

  const sb = await createClient();
  const me = await getMyProfile(sb);
  const allowed = me?.account_id && !me.deactivated_at && (me.role === "doctor" || me.role === "admin");
  if (!allowed) return NextResponse.json({ error: "Only doctors and admins can export patient records." }, { status: 403 });
  if (me.role === "admin" && !(await hasTwoFactorSession(sb))) {
    return NextResponse.json({ error: "Finish two-factor sign-in first." }, { status: 403 });
  }

  const record = await loadPatientRecord(sb, id.data);
  if (!record) return NextResponse.json({ error: "Unknown patient." }, { status: 404 });
  await auditPatientExport(me.id, me.account_id!, id.data, "json");

  const slug = record.patient.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
  return new NextResponse(JSON.stringify(record, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="patient-record-${slug}-${record.exported_at.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
