"use client";

import { Icon } from "./icons";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button
      variant="outline"
      className="no-print"
      type="button"
      onClick={() => window.print()}>
      <Icon name="print" /> {label}
    </Button>
  );
}
