import Link from "next/link";
import { redirect } from "next/navigation";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon, ShieldCheckIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Data export" };

const INCLUDED = [
  "Clinics, staff, doctor hours and secretary assignments",
  "Patients and their clinics",
  "Appointments",
  "Visits: complaints, diagnoses, vitals, notes",
  "Prescriptions, lab requests and results, problem lists",
  "Your library quick picks",
  "The audit log",
];

const fmtWhen = (d: string) =>
  new Date(d).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Admin → Data export: download everything the clinic has in the app. */
export default async function ExportPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin") redirect("/today");

  const { data: recent } = await sb.from("audit_log")
    .select("occurred_at, actor_id, after").eq("table_name", "exports").order("occurred_at", { ascending: false }).limit(20);
  const lastClinic = (recent ?? []).find(e => (e.after as any)?.kind === "clinic");
  const patientExports = (recent ?? []).filter(e => (e.after as any)?.kind === "patient").length;
  let lastBy: string | null = null;
  if (lastClinic?.actor_id) {
    const { data } = await sb.from("profiles").select("full_name").eq("id", lastClinic.actor_id).maybeSingle();
    lastBy = data?.full_name ?? null;
  }

  return (
    <>
      <PageHeader icon="settings" title="Data export" sub="Take a copy of your clinic’s data, any time" />

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheetIcon className="size-4 text-primary" /> Whole clinic</CardTitle>
            <CardDescription>A ZIP of spreadsheet files (CSV), one per kind of record, with a README explaining them.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <ul className="grid gap-1.5">
              {INCLUDED.map(i => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{i}</li>)}
            </ul>
            <p className="text-muted-foreground">
              Lab result files are listed by name but not included. Download them from each visit.
            </p>
            {lastClinic && (
              <p className="text-muted-foreground">
                Last exported {fmtWhen(lastClinic.occurred_at)}{lastBy ? ` by ${lastBy}` : ""}.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            {/* A plain link: the route builds the ZIP and redirects to a 5-minute download link. */}
            <Button asChild><a href="/api/export/clinic"><DownloadIcon /> Download export</a></Button>
            <span className="text-xs text-muted-foreground">Large clinics can take up to a minute.</span>
          </CardFooter>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileTextIcon className="size-4 text-primary" /> One patient</CardTitle>
              <CardDescription>For a patient asking for a copy of their records.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Open the patient and click <strong className="text-foreground">Export record</strong>: a printable copy (save as PDF) plus a JSON file for moving to another system.
              {patientExports > 0 && ` ${patientExports} patient export${patientExports === 1 ? "" : "s"} in the recent log.`}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheckIcon className="size-4 text-primary" /> Handle with care</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Exports contain patients’ health information. Store them securely and share them only as the Data Privacy Act allows.
              Every export is recorded in the <Link href="/admin/audit?table=exports" className="underline">audit log</Link>.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
