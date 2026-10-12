import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryList } from "./library-list";

export default async function LibraryAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const sb = await createClient();
  const [meds, labs, conds] = await Promise.all([
    sb.from("common_medications").select("id, name, default_dosage, default_frequency, default_instructions").order("name"),
    sb.from("common_lab_tests").select("id, name, description").order("name"),
    sb.from("common_conditions").select("id, name, icd_code").order("name"),
  ]);
  const lists = [
    { value: "meds", label: "Medications", items: meds.data ?? [] },
    { value: "labs", label: "Lab tests", items: labs.data ?? [] },
    { value: "conds", label: "Conditions", items: conds.data ?? [] },
  ] as const;

  return (
    <>
      <PageHeader icon="settings" title="Most-used library"
        sub="Quick picks for visits. Edits never change past records — visits keep their own copy." />

      <Tabs defaultValue={lists.some(l => l.value === tab) ? tab : "meds"} className="gap-4">
        <TabsList>
          {lists.map(l => (
            <TabsTrigger key={l.value} value={l.value}>
              {l.label} <span className="text-xs font-normal tabular-nums text-muted-foreground">{l.items.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {lists.map(l => (
          <TabsContent key={l.value} value={l.value}>
            <LibraryList kind={l.value} items={l.items as never} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
