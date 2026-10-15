"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoonIcon, SearchIcon, SunIcon, UserIcon, UserRoundIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import {
  CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { NAV_ICONS, type NavLink } from "./nav-icons";

type Patient = { id: string; full_name: string; phone: string | null };

/** Opens on ⌘K / Ctrl+K (or the sidebar button): jump to pages, find patients. */
export function CommandMenu({ open, onOpenChange, links }: {
  open: boolean; onOpenChange: (o: boolean) => void; links: NavLink[];
}) {
  const router = useRouter();
  const sb = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Browser autofill fires keydown events without a key; ignore those.
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Patient search (RLS limits results to what this user may see).
  useEffect(() => {
    const term = q.replace(/[,()%*\\]/g, " ").trim();
    if (term.length < 2) { setPatients([]); return; }
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await sb.from("patients").select("id, full_name, phone")
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`).order("full_name").limit(8);
      if (live) { setPatients(data ?? []); setSearching(false); }
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, sb]);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const setTheme = (mode: "light" | "dark") => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    try { localStorage.setItem("theme", mode); } catch {}
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Jump to a page or find a patient">
      <Command>
        <CommandInput value={q} onValueChange={setQ} placeholder="Search pages and patients…" />
        <CommandList>
          <CommandEmpty>{searching ? <span className="inline-flex items-center gap-2"><Spinner /> Searching…</span> : "No results."}</CommandEmpty>
          {patients.length > 0 && (
            <CommandGroup heading="Patients">
              {patients.map(p => (
                <CommandItem key={p.id} value={`patient ${p.full_name} ${p.phone ?? ""}`} onSelect={() => go(`/patients/${p.id}`)}>
                  <UserRoundIcon />
                  <span>{p.full_name}</span>
                  {p.phone && <span className="ml-auto text-xs text-muted-foreground">{p.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Go to">
            {links.map(l => {
              const I = NAV_ICONS[l.icon] ?? SearchIcon;
              return (
                <CommandItem key={l.href} value={`page ${l.label}`} onSelect={() => go(l.href)}>
                  <I />{l.label}
                </CommandItem>
              );
            })}
            <CommandItem value="page account settings profile password" onSelect={() => go("/account")}>
              <UserIcon />Account settings
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem value="theme light mode" onSelect={() => setTheme("light")}><SunIcon />Light mode</CommandItem>
            <CommandItem value="theme dark mode" onSelect={() => setTheme("dark")}><MoonIcon />Dark mode</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Type 2+ letters to search patients</span>
        <CommandShortcut>⌘K</CommandShortcut>
      </div>
    </CommandDialog>
  );
}
