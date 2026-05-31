"use client";

import { useRef } from "react";
import { setActiveClinic } from "@/lib/actions/clinic-context";
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

export function ClinicSwitcher({
  clinics,
  activeClinic,
  isAdmin,
}: {
  clinics: Clinic[];
  activeClinic: string | null;
  isAdmin: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

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

  return (
    <form ref={formRef} action={setActiveClinic} className="switcher" style={{ position: "relative" }}>
      <span className="mark">{mark}</span>
      <span className="meta">
        <span className="name">{name}</span>
      </span>
      <Icon name="chev-updown" className="chev" size={15} />
      <select
        name="clinic_id"
        defaultValue={activeClinic ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Active clinic"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
      >
        {isAdmin && <option value="">All clinics</option>}
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
