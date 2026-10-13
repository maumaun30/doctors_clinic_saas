// Loading placeholders for the App Router loading.tsx files. Each page
// skeleton is built from the same pieces as its page (page-head, stats,
// Card, Table, Tabs, settings sections) so content swaps in without the
// layout jumping. Real labels (table headings, tab names) are shown where
// they never change; everything data-driven is a shimmer bone.

import { Skeleton as Bone } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
// Varied widths so rows don't look like a barcode.
const W = ["w-40", "w-32", "w-44", "w-28", "w-36", "w-24"];
const w = (i: number) => W[i % W.length];

/** Announces loading to assistive tech; the bones themselves are decorative. */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="skeleton-page">
      {children}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ---------- page header ----------

type Lead = "icon" | "avatar" | "back-avatar" | "back-icon";

function Head({ lead = "icon", actions = 0, sub = true }: { lead?: Lead; actions?: number; sub?: boolean }) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {lead.startsWith("back") && <Bone className="size-9" />}
        {lead.endsWith("avatar") ? <Bone className="size-12 rounded-full" /> : <Bone className="size-11 rounded-xl" />}
        <div className="grid gap-2">
          <Bone className="h-6 w-44" />
          {sub && <Bone className="h-4 w-64 max-w-[50vw]" />}
        </div>
      </div>
      {actions > 0 && (
        <div className="head-actions">
          {range(actions).map(i => <Bone key={i} className={cn("h-9", i === actions - 1 ? "w-36" : "w-28")} />)}
        </div>
      )}
    </div>
  );
}

// ---------- building blocks ----------

function Stats({ count = 4, footer = false }: { count?: number; footer?: boolean }) {
  return (
    <div className="stats">
      {range(count).map(i => (
        <Card key={i} size="sm">
          <CardHeader>
            <Bone className="h-4 w-20" />
            <Bone className="h-7 w-14" />
            {footer && <Bone className="h-3 w-24" />}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

/** Pill group like the date-range presets. */
function Segmented({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {range(count).map(i => <Bone key={i} className="h-7 w-16 bg-background/70" />)}
    </div>
  );
}

/** A card with a title (and optional description) and free-form content. */
function Box({ desc = false, title = "w-32", className, children, footer }: {
  desc?: boolean; title?: string; className?: string; children?: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <Bone className={cn("h-5", title)} />
        {desc && <Bone className="h-4 w-60 max-w-full" />}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {footer && <CardFooter className="gap-2">{footer}</CardFooter>}
    </Card>
  );
}

function Fields({ count = 2, cols = 1 }: { count?: number; cols?: 1 | 2 }) {
  return (
    <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2")}>
      {range(count).map(i => (
        <div key={i} className="grid gap-2">
          <Bone className="h-4 w-24" />
          <Bone className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Label / value pairs (dl.kv). */
function Kv({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3">
      {range(rows).map(i => (
        <span key={i} className="contents">
          <Bone className="h-4 w-16" />
          <Bone className={cn("h-4", w(i))} />
        </span>
      ))}
    </div>
  );
}

/** Bordered list rows (upcoming visits, assignments). */
function ItemRows({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-2">
      {range(count).map(i => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="grid gap-1.5">
            <Bone className={cn("h-4", w(i))} />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Weekday rows of the weekly-hours view (availability/week-view.tsx). */
function WeekRows() {
  return (
    <div className="grid gap-1">
      {range(7).map(i => (
        <div key={i} className="grid grid-cols-[6rem_1fr] items-center gap-3 border-t py-2 md:grid-cols-[6rem_1fr_minmax(0,21rem)]">
          <Bone className="h-4 w-12" />
          <Bone className="hidden h-5 md:block" />
          <Bone className={cn("h-6 rounded-full", i % 3 === 2 ? "w-16" : "w-32")} />
        </div>
      ))}
    </div>
  );
}

type Col = {
  label?: string;
  /** Responsive visibility, mirroring the page's TableHead classes. */
  hide?: "md" | "lg" | "xl";
  cell?: "person" | "text" | "badge" | "num" | "action" | "time";
  className?: string;
};
const HIDE = { md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;

function cellBone(c: Col, i: number) {
  switch (c.cell) {
    case "person":
      return (
        <div className="flex items-center gap-3">
          <Bone className="size-[30px] shrink-0 rounded-full" />
          <div className="grid gap-1.5">
            <Bone className={cn("h-4", w(i))} />
            <Bone className="h-3 w-24" />
          </div>
        </div>
      );
    case "time":
      return <div className="grid gap-1.5"><Bone className="h-4 w-14" /><Bone className="h-3 w-8" /></div>;
    case "badge":
      return <Bone className="h-5 w-20 rounded-full" />;
    case "num":
      return <Bone className="ml-auto h-4 w-8" />;
    case "action":
      return <Bone className="ml-auto size-7" />;
    default:
      return <Bone className={cn("h-4", w(i + 2))} />;
  }
}

/** A table inside a card, with the page's real column headings. */
function TableCard({ cols, rows = 6, group = false }: { cols: Col[]; rows?: number; group?: boolean }) {
  return (
    <div className="card table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c, i) => (
              <TableHead key={i} className={cn(c.hide && HIDE[c.hide], c.cell === "num" && "text-right", c.className)}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {group && (
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableCell colSpan={cols.length} className="py-2"><Bone className="h-3 w-32" /></TableCell>
            </TableRow>
          )}
          {range(rows).map(r => (
            <TableRow key={r} className="hover:bg-transparent">
              {cols.map((c, i) => (
                <TableCell key={i} className={cn(c.hide && HIDE[c.hide], "py-3")}>{cellBone(c, r + i)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Static tab strip with the page's real tab names; the first is selected. */
function TabStrip({ tabs }: { tabs: string[] }) {
  return (
    <Tabs defaultValue="0" className="mb-4">
      <TabsList>
        {tabs.map((t, i) => <TabsTrigger key={t} value={String(i)} disabled={i > 0}>{t}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );
}

/** Settings-style section (app/_components/section.tsx). */
function SectionSkel({ children, flush = false }: { children: React.ReactNode; flush?: boolean }) {
  return (
    <section className="settings-section">
      <div className="settings-intro grid content-start gap-2">
        <Bone className="h-4 w-28" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-2/3" />
      </div>
      <div className={cn("card settings-card", flush && "flush")}>{children}</div>
    </section>
  );
}

// ---------- pages ----------

export function TodaySkeleton() {
  return (
    <Page>
      <Head actions={2} />
      <Stats count={4} />
      <div className="card">
        <div className="section-bar"><Bone className="h-3.5 w-36" /></div>
        <div className="queue">
          {range(5).map(i => (
            <div key={i} className="queue-row">
              <div className="grid gap-1.5"><Bone className="h-4 w-14" /><Bone className="h-3 w-8" /></div>
              <div className="grid gap-1.5"><Bone className={cn("h-4", w(i))} /><Bone className="h-3 w-28" /></div>
              <div className="flex items-center gap-2"><Bone className="h-5 w-20 rounded-full" /><Bone className="size-7" /></div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

export function ScheduleSkeleton() {
  return (
    <Page>
      <Head actions={2} />
      <div className="filters flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented count={4} />
          <Bone className="h-9 w-40" />
          <Bone className="h-4 w-4" />
          <Bone className="h-9 w-40" />
          <Bone className="h-8 w-16" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {range(6).map(i => <Bone key={i} className={cn("h-7 rounded-full", i === 0 ? "w-14" : "w-24")} />)}
        </div>
      </div>
      <TableCard group rows={6} cols={[
        { label: "Time", cell: "time", className: "w-28" },
        { label: "Patient", cell: "text" },
        { label: "Provider", cell: "text", hide: "md" },
        { label: "Status", cell: "badge" },
        { cell: "action", className: "w-12" },
      ]} />
    </Page>
  );
}

export function PatientsSkeleton() {
  return (
    <Page>
      <Head actions={1} />
      <div className="filters">
        <Bone className="h-9 min-w-60 flex-1 sm:max-w-sm" />
        <Bone className="h-9 w-32" />
        <Bone className="h-9 w-40" />
        <Bone className="h-9 w-44" />
        <Bone className="ml-auto h-9 w-44" />
      </div>
      <TableCard rows={8} cols={[
        { label: "Patient", cell: "person" },
        { label: "Mobile", cell: "text", hide: "md" },
        { label: "Last visit", cell: "text", hide: "md" },
        { label: "Next appointment", cell: "text", hide: "lg" },
        { label: "Active problems", cell: "badge", hide: "xl" },
        { cell: "action", className: "w-10" },
      ]} />
    </Page>
  );
}

export function PatientSkeleton() {
  return (
    <Page>
      <Head lead="back-avatar" actions={2} />
      <TabStrip tabs={["Overview", "Visits", "Prescriptions", "Labs"]} />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Box desc title="w-20"><Kv rows={6} /></Box>
        <div className="grid content-start gap-4">
          <Box desc title="w-24"><ItemRows count={2} /></Box>
          <Box desc title="w-20">
            <div className="grid gap-3">
              <div className="flex gap-2"><Bone className="h-5 w-24 rounded-full" /><Bone className="h-5 w-20 rounded-full" /></div>
              <div className="flex gap-2"><Bone className="h-9 flex-1" /><Bone className="h-9 w-16" /></div>
            </div>
          </Box>
        </div>
      </div>
    </Page>
  );
}

export function VisitSkeleton() {
  return (
    <Page>
      <Head lead="back-icon" actions={2} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          <Box title="w-20"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{range(4).map(i => (
            <div key={i} className="grid gap-2"><Bone className="h-4 w-16" /><Bone className="h-9" /></div>
          ))}</div></Box>
          <Box title="w-36"><Fields count={2} cols={2} /></Box>
          <Box title="w-28"><Bone className="h-20 w-full" /></Box>
        </div>
        <Box title="w-20">
          <div className="grid gap-3">
            <Bone className="h-4 w-40" />
            <Bone className="h-3 w-28" />
            <Bone className="h-3 w-32" />
            <Bone className="mt-2 h-8 w-full" />
          </div>
        </Box>
      </div>
    </Page>
  );
}

export function PrescriptionSkeleton() {
  return (
    <Page>
      <Card className="mx-auto max-w-2xl">
        <CardContent className="grid gap-6 py-4">
          <div className="grid justify-items-center gap-2"><Bone className="h-6 w-56" /><Bone className="h-4 w-40" /></div>
          <Kv rows={3} />
          <div className="grid gap-3">{range(3).map(i => <Bone key={i} className={cn("h-4", i === 2 ? "w-1/2" : "w-full")} />)}</div>
          <div className="ml-auto grid justify-items-end gap-2"><Bone className="h-4 w-40" /><Bone className="h-3 w-28" /></div>
        </CardContent>
      </Card>
    </Page>
  );
}

export function AvailabilitySkeleton() {
  return (
    <Page>
      <Head />
      <div className="grid gap-4">
        {range(2).map(i => <Box key={i} desc title="w-48"><WeekRows /></Box>)}
      </div>
    </Page>
  );
}

export function AnalyticsSkeleton() {
  return (
    <Page>
      <Head actions={1} />
      <div className="filters">
        <Segmented count={4} />
        <Bone className="h-9 w-44" />
      </div>
      <Stats count={8} footer />
      <div className="grid gap-4">
        <Box desc title="w-48"><Bone className="h-48 w-full" /></Box>
        <div className="grid gap-4 lg:grid-cols-2">
          {range(3).map(i => (
            <Box key={i} title="w-32">
              <div className="grid gap-3">{range(4).map(r => <Bone key={r} className={cn("h-4", w(r + i))} />)}</div>
            </Box>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ---------- admin ----------

export function DoctorsSkeleton() {
  return (
    <Page>
      <Head actions={1} />
      <TableCard rows={4} cols={[
        { label: "Doctor", cell: "person" },
        { label: "Clinics", cell: "badge", hide: "md" },
        { label: "Weekly hours", cell: "text" },
        { label: "Next 7 days", cell: "num", hide: "lg" },
        { label: "Seen (30 days)", cell: "num", hide: "lg" },
        { cell: "action", className: "w-10" },
      ]} />
    </Page>
  );
}

export function SecretariesSkeleton() {
  return (
    <Page>
      <Head actions={1} />
      <TableCard rows={4} cols={[
        { label: "Secretary", cell: "person" },
        { label: "Supports", cell: "text" },
        { label: "Clinics", cell: "badge", hide: "md" },
        { cell: "action", className: "w-10" },
      ]} />
    </Page>
  );
}

/** Doctor or secretary detail: profile form, then assignments / hours. */
export function StaffDetailSkeleton({ hours = false }: { hours?: boolean }) {
  return (
    <Page>
      <Head lead="back-avatar" />
      <div className="grid gap-4">
        <Box desc title="w-20"><Fields count={hours ? 3 : 2} cols={2} /></Box>
        <Box desc title="w-28"><ItemRows count={2} /></Box>
        {hours && <Box desc title="w-48"><WeekRows /></Box>}
      </div>
    </Page>
  );
}

export function TeamSkeleton() {
  return (
    <Page>
      <Head actions={1} />
      <TabStrip tabs={["Members", "Open invites"]} />
      <TableCard rows={5} cols={[
        { label: "Name", cell: "person" },
        { label: "Role", cell: "badge" },
        { label: "Mobile", cell: "text", hide: "md" },
        { cell: "action", className: "w-10" },
      ]} />
    </Page>
  );
}

export function ClinicsSkeleton() {
  return (
    <Page>
      <Head actions={1} />
      <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        {range(2).map(i => (
          <Card key={i} className="min-w-0">
            <CardHeader>
              <Bone className="h-5 w-36" />
              <Bone className="h-4 w-52 max-w-full" />
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-3 gap-2">{range(3).map(t => <Bone key={t} className="h-[60px] rounded-lg" />)}</div>
              <Bone className="h-11 rounded-lg" />
            </CardContent>
            <CardFooter className="gap-2"><Bone className="h-8 w-36" /></CardFooter>
          </Card>
        ))}
      </div>
    </Page>
  );
}

export function LibrarySkeleton() {
  return (
    <Page>
      <Head />
      <TabStrip tabs={["Medications", "Lab tests", "Conditions"]} />
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-9 min-w-56 flex-1 sm:max-w-xs" />
          <Bone className="h-9 w-40" />
        </div>
        <TableCard rows={6} cols={[
          { label: "Name", cell: "text" },
          { cell: "text" },
          { cell: "text", hide: "md" },
          { cell: "action", className: "w-20" },
        ]} />
      </div>
    </Page>
  );
}

export function AuditSkeleton() {
  return (
    <Page>
      <Head />
      <div className="filters">
        <Segmented count={4} />
        <Bone className="h-9 w-44" />
        <Bone className="h-9 w-48" />
        <Bone className="h-8 w-16" />
      </div>
      <div className="grid gap-4">
        {[5, 3].map((n, s) => (
          <section key={s} className="card overflow-hidden">
            <div className="border-b bg-muted/50 px-4 py-2.5"><Bone className="h-3 w-40" /></div>
            <ul className="divide-y">
              {range(n).map(i => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Bone className="h-4 w-14 shrink-0" />
                  <Bone className="size-6 shrink-0 rounded-full" />
                  <Bone className={cn("h-4", i % 2 ? "w-72" : "w-96", "max-w-[55vw]")} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}

export function BillingSkeleton() {
  return (
    <Page>
      <Head />
      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Box desc title="w-24" footer={<><Bone className="h-9 w-36" /><Bone className="h-9 w-28" /></>}>
          <div className="grid gap-5">
            <div className="flex flex-wrap items-end gap-6"><Bone className="h-10 w-32" /><Bone className="h-9 w-44 rounded-lg" /></div>
            <div className="grid gap-2">
              <div className="flex justify-between"><Bone className="h-4 w-24" /><Bone className="h-4 w-16" /></div>
              <Bone className="h-2 w-full rounded-full" />
            </div>
          </div>
        </Box>
        <Box title="w-40">
          <div className="grid gap-3">{range(4).map(i => <Bone key={i} className={cn("h-4", i === 3 ? "w-2/3" : "w-full")} />)}</div>
        </Box>
      </div>
    </Page>
  );
}

export function AccountSkeleton() {
  return (
    <Page>
      <Head lead="avatar" />
      <SectionSkel>
        <div className="grid gap-4">
          <div className="flex items-center gap-4"><Bone className="size-16 rounded-full" /><Bone className="h-8 w-32" /></div>
          <Fields count={1} />
          <Fields count={2} cols={2} />
        </div>
      </SectionSkel>
      <SectionSkel flush>
        {range(2).map(i => (
          <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Bone className="size-9" />
            <div className="grid flex-1 gap-1.5"><Bone className="h-4 w-32" /><Bone className="h-3 w-44" /></div>
            <Bone className="h-8 w-28" />
          </div>
        ))}
      </SectionSkel>
      <SectionSkel><div className="flex items-center gap-3"><Bone className="size-9 rounded-full" /><Bone className="h-4 flex-1" /><Bone className="h-8 w-40" /></div></SectionSkel>
      <SectionSkel><div className="flex items-center justify-between"><Bone className="h-4 w-16" /><Bone className="h-8 w-28" /></div></SectionSkel>
    </Page>
  );
}

/** Fallback for routes without their own skeleton. */
export function GenericSkeleton() {
  return (
    <Page>
      <Head />
      <Box desc title="w-40">
        <div className="grid gap-3">{range(5).map(i => <Bone key={i} className={cn("h-4", i === 4 ? "w-1/2" : "w-full")} />)}</div>
      </Box>
    </Page>
  );
}

/** Public booking page (/book/<slug>): brand, title, then the three steps. */
export function BookingCardSkeleton() {
  const step = (children: React.ReactNode) => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2"><Bone className="size-5 rounded-full" /><Bone className="h-4 w-24" /></div>
      {children}
    </div>
  );
  return (
    <div className="auth-screen">
      <div className="card auth-card book-card">
        <Page>
          <div className="auth-brand">
            <Bone className="size-[34px] rounded-lg" />
            <Bone className="h-4 w-36" />
          </div>
          <Bone className="mb-2 h-6 w-52" />
          <Bone className="mb-6 h-4 w-64 max-w-full" />
          <div className="grid gap-6">
            {step(<div className="grid gap-2">{range(2).map(i => <Bone key={i} className="h-[54px] rounded-lg" />)}</div>)}
            {step(<>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">{range(7).map(i => <Bone key={i} className="h-11 rounded-lg" />)}</div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">{range(8).map(i => <Bone key={i} className="h-8" />)}</div>
            </>)}
            {step(<Fields count={2} cols={2} />)}
            <Bone className="h-10 w-full" />
          </div>
        </Page>
      </div>
    </div>
  );
}
