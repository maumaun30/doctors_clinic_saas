import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths } from "@/app/_components/age";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchXIcon } from "lucide-react";
import { PatientDialog } from "./patient-dialog";

function initials(name: string) {
  return (name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?");
}

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const sb = await createClient();
  const activeClinic = await getActiveClinicId(sb);

  let patientIds: string[] | null = null;
  if (activeClinic) {
    const { data, error } = await sb.from("patient_clinics")
      .select("patient_id").eq("clinic_id", activeClinic);
    if (error) throw error;
    patientIds = data.map(r => r.patient_id);
  }

  let query = sb.from("patients")
    .select("id, full_name, date_of_birth, sex, phone")
    .order("full_name");
  if (patientIds) {
    if (patientIds.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("id", patientIds);
    }
  }
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`full_name.ilike.${term},phone.ilike.${term}`);
  }
  const { data: patients, error } = await query;
  if (error) throw error;

  const sub = (p: any) =>
    [p.sex, ageYearsMonths(p.date_of_birth), p.phone].filter(Boolean).join(" · ") || "—";

  return (
    <>
      <PageHeader icon="users" title="Patients"
        sub={`${patients.length} ${patients.length === 1 ? "patient" : "patients"}${activeClinic ? " · active clinic" : ""}`}
        actions={activeClinic && <PatientDialog />} />

      <form method="get" className="filters">
        <div className="search" style={{ maxWidth: 420 }}>
          <Icon name="search" />
          <Input name="q" defaultValue={q ?? ""} placeholder="Search by name or phone" className="pl-9" />
        </div>
        <Button variant="outline" type="submit">Search</Button>
        {q && <Button asChild variant="ghost"><Link href="/patients">Clear</Link></Button>}
      </form>

      <div className="card">
        {patients.length === 0
          ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SearchXIcon className="size-5" />
              </div>
              <div>
                <div className="font-medium">{q ? <>No patients match “{q}”</> : "No patients yet"}</div>
                <div className="text-sm text-muted-foreground">
                  {q ? "Try part of the name or the phone number." : "Add the first patient for this clinic."}
                </div>
              </div>
              <div className="flex gap-2">
                {q && <Button asChild variant="outline"><Link href="/patients">Clear search</Link></Button>}
                {activeClinic && <PatientDialog />}
              </div>
            </div>
          )
          : patients.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} className="plist-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span className="avatar">{initials(p.full_name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="strong">{p.full_name}</div>
                  <div className="plist-id">{sub(p)}</div>
                </div>
              </div>
              <Icon name="chevright" style={{ color: "var(--fg-subtle)", width: 16, height: 16 }} />
            </Link>
          ))}
      </div>

      {!activeClinic && (
        <p className="hint" style={{ marginTop: 16 }}>Pick an active clinic in the sidebar to add a patient.</p>
      )}
    </>
  );
}
