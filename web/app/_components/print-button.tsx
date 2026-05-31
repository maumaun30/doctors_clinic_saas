"use client";

import { Icon } from "./icons";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
      <Icon name="print" /> {label}
    </button>
  );
}
