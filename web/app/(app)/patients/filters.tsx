"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

type Opt = { value: string; label: string };
export const SEX: Opt[] = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }];
export const AGE: Opt[] = [
  { value: "child", label: "Children (under 18)" },
  { value: "adult", label: "Adults (18–59)" },
  { value: "senior", label: "Seniors (60+)" },
];
export const VISIT: Opt[] = [
  { value: "upcoming", label: "Has upcoming visit" },
  { value: "lapsed", label: "No visit in 6 months" },
  { value: "new", label: "Added in last 30 days" },
];
// "" (no param) means name A–Z.
const SORT: Opt[] = [{ value: "recent", label: "Sort: Recently added" }];

// Search + filter bar for the patients list. Everything lives in the URL
// (shareable, works with back/forward); search is debounced.
export function PatientFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  const push = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    next.delete("page"); // any filter change starts from page 1
    const s = next.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => push({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // push reads the latest params; re-running only on q is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", "sex", "age", "visit"].some(k => params.get(k));
  const select = (key: string, all: string, opts: Opt[], width = "w-44") => (
    <NativeSelect value={params.get(key) ?? ""} onChange={e => push({ [key]: e.target.value || null })}
      aria-label={all} className={width}>
      <NativeSelectOption value="">{all}</NativeSelectOption>
      {opts.map(o => <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>)}
    </NativeSelect>
  );

  return (
    <div className="filters flex-col items-stretch gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone or email"
            aria-label="Search patients" className="pl-8" type="search" />
        </div>
        {select("sex", "Any sex", SEX, "w-32")}
        {select("age", "Any age", AGE, "w-40")}
        {select("visit", "Any visit history", VISIT, "w-44")}
        <div className="ml-auto flex items-center gap-2">
          {pending && <Spinner className="text-muted-foreground" />}
          {active && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); start(() => router.replace(pathname)); }}>
              <XIcon /> Clear
            </Button>
          )}
          {select("sort", "Sort: Name A–Z", SORT, "w-44")}
        </div>
      </div>
    </div>
  );
}
