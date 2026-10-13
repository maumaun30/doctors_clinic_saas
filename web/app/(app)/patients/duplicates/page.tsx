import Link from "next/link";
import { redirect } from "next/navigation";
import { CopyCheckIcon, MergeIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { Icon } from "@/app/_components/icons";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSummaries, type PatientSummary } from "./summary";
import { DismissButton } from "./dismiss-button";

export const metadata = { title: "Possible duplicates" };

const TZ = "Asia/Manila";
const fmtDate = (d: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00+08:00` : d).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" }) : null;

function Mini({ p }: { p: PatientSummary }) {
  const facts = [
    fmtDate(p.date_of_birth) && `Born ${fmtDate(p.date_of_birth)}`,
    p.phone, p.email,
  ].filter(Boolean);
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border p-3 text-sm">
      <Link href={`/patients/${p.id}`} className="truncate font-medium hover:underline">{p.full_name}</Link>
      <div className="truncate text-muted-foreground">{facts.join(" · ") || "No details"}</div>
      <div className="text-xs text-muted-foreground">
        {p.visits} {p.visits === 1 ? "visit" : "visits"} · {p.appointments} {p.appointments === 1 ? "appointment" : "appointments"}
        {" · added "}{fmtDate(p.created_at)}
      </div>
    </div>
  );
}

/** Admins: likely duplicate patients, to merge or dismiss. */
export default async function DuplicatesPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin") redirect("/patients");

  const { data, error } = await sb.rpc("admin_find_duplicate_patients", { p_limit: 100 });
  if (error) throw new Error(error.message);
  const pairs = data ?? [];
  const people = await loadSummaries(sb, [...new Set(pairs.flatMap(p => [p.patient_a, p.patient_b]))]);

  return (
    <>
      <PageHeader
        leading={<Button asChild variant="ghost" size="icon"><Link href="/patients" aria-label="Back to patients"><Icon name="back" /></Link></Button>}
        title="Possible duplicates"
        sub={pairs.length ? `${pairs.length} ${pairs.length === 1 ? "pair" : "pairs"} to review` : "Nothing to review"} />

      {pairs.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CopyCheckIcon className="size-5" />
          </div>
          <div>
            <div className="font-medium">No likely duplicates</div>
            <div className="max-w-md text-sm text-muted-foreground">
              We look for patients with the same name and birthday, mobile or email. To merge two records yourself, open a patient and click Merge.
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {pairs.map(pair => {
            const a = people.get(pair.patient_a), b = people.get(pair.patient_b);
            if (!a || !b) return null;
            return (
              <Card key={`${a.id}-${b.id}`} size="sm">
                <CardHeader>
                  <CardTitle className="text-sm"><Badge variant={pair.reason === "Same name" ? "secondary" : "warning"}>{pair.reason}</Badge></CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  <Mini p={a} />
                  <Mini p={b} />
                </CardContent>
                <CardFooter className="flex-wrap justify-end gap-2">
                  <DismissButton a={a.id} b={b.id} />
                  <Button asChild variant="outline"><Link href={`/patients/merge?a=${a.id}&b=${b.id}`}><MergeIcon /> Compare & merge</Link></Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
