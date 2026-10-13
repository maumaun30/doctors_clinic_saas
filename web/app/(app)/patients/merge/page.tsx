import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/app/_components/page-header";
import { Icon } from "@/app/_components/icons";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSummaries, suggestKeep } from "../duplicates/summary";
import { MergeForm } from "./merge-form";

export const metadata = { title: "Merge patients" };

const id = z.string().uuid();
const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }) : null;

/**
 * Admins: merge two patient records. With only `a`, pick the other
 * record by searching; with `a` and `b`, compare and choose which to keep.
 */
export default async function MergePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string; q?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin") redirect(sp.a ? `/patients/${sp.a}` : "/patients");
  if (!id.safeParse(sp.a).success) redirect("/patients/duplicates");
  const a = sp.a!;
  const b = id.safeParse(sp.b).success && sp.b !== a ? sp.b! : null;

  const people = await loadSummaries(sb, b ? [a, b] : [a]);
  const first = people.get(a);
  if (!first) notFound();
  const back = (
    <Button asChild variant="ghost" size="icon">
      <Link href={b ? "/patients/duplicates" : `/patients/${a}`} aria-label="Back"><Icon name="back" /></Link>
    </Button>
  );

  if (b) {
    const second = people.get(b);
    if (!second) notFound();
    return (
      <>
        <PageHeader leading={back} title="Merge patients" sub="Combine two records for the same person" />
        <MergeForm a={first} b={second} defaultKeep={suggestKeep(first, second)} />
      </>
    );
  }

  // Pick the second record. Default search: the first word of the name.
  const q = (sp.q ?? first.full_name.trim().split(/\s+/)[0] ?? "").replace(/[,()%*\\]/g, " ").trim();
  const { data: matches } = q
    ? await sb.from("patients").select("id, full_name, date_of_birth, phone")
        .neq("id", a).or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`).order("full_name").limit(20)
    : { data: [] };

  return (
    <>
      <PageHeader leading={back} title={`Merge ${first.full_name}`} sub="Find the other record for the same person" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Which record is the duplicate?</CardTitle>
          <CardDescription>Search by name, mobile or email. You’ll compare both before anything changes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form className="flex gap-2">
            <input type="hidden" name="a" value={a} />
            <Input name="q" defaultValue={q} placeholder="Name, mobile or email" aria-label="Search patients" />
            <Button type="submit" variant="outline"><SearchIcon /> Search</Button>
          </form>
          {(matches ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? "No other patients match." : "Type a name to search."}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {(matches ?? []).map(m => (
                <li key={m.id}>
                  <Link href={`/patients/merge?a=${a}&b=${m.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[fmtDate(m.date_of_birth) && `Born ${fmtDate(m.date_of_birth)}`, m.phone].filter(Boolean).join(" · ") || "No details"}
                      </span>
                    </span>
                    <Icon name="chevright" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
