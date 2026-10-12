"use client";

import { useRef, useState, useTransition } from "react";
import { setActiveClinic } from "@/lib/actions/clinic-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "./icons";

type Clinic = { id: string; name: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// "" is the admin-only "All clinics" choice (clears the cookie).
const ALL = "";

export function ClinicSwitcher({
  clinics,
  activeClinic,
  isAdmin,
}: {
  clinics: Clinic[];
  activeClinic: string | null;
  isAdmin: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [side, setSide] = useState<"bottom" | "right">("bottom");
  const [pending, startTransition] = useTransition();

  const active = clinics.find((c) => c.id === activeClinic) ?? null;
  const name = active ? active.name : isAdmin ? "All clinics" : clinics[0]?.name ?? "Clinic";
  const mark = active ? initials(active.name) : isAdmin ? "ALL" : initials(name);

  // Single clinic and non-admin: plain, non-interactive label.
  if (clinics.length <= 1 && !isAdmin) {
    return (
      <div className="switcher">
        <span className="mark">{mark}</span>
        <span className="meta">
          <span className="name">{name}</span>
        </span>
      </div>
    );
  }

  const choose = (id: string) => {
    if (id === (activeClinic ?? ALL)) return;
    const fd = new FormData();
    fd.set("clinic_id", id);
    startTransition(() => setActiveClinic(fd));
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setSide(triggerRef.current?.closest(".app.collapsed") ? "right" : "bottom");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="switcher"
          aria-label={`Active clinic: ${name}`}
          aria-busy={pending}
          title={name}
        >
          <span className="mark">{mark}</span>
          <span className="meta">
            <span className="name">{name}</span>
          </span>
          <Icon name="chev-updown" className="chev" size={15} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align="start"
        sideOffset={side === "bottom" ? 6 : 10}
        className={side === "bottom" ? "min-w-56" : "w-60"}
      >
        <DropdownMenuLabel>Clinics</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={activeClinic ?? ALL} onValueChange={choose}>
          {isAdmin && (
            <>
              <DropdownMenuRadioItem value={ALL} className="py-1.5">All clinics</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
            </>
          )}
          {clinics.map((c) => (
            <DropdownMenuRadioItem key={c.id} value={c.id} className="py-1.5">
              <span className="truncate">{c.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
