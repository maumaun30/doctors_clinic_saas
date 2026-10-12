"use client";

import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Icon } from "./icons";

export function ThemeToggle() {
  // Initial value is set pre-paint by the blocking script in app/layout.tsx.
  // We read the resulting class after mount to sync the toggle state.
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const set = (next: string) => {
    // Single-select group: clicking the active item yields "" — ignore it.
    if (next !== "light" && next !== "dark") return;
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setMode(next);
  };

  return (
    <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={set} aria-label="Theme">
      <ToggleGroupItem value="light" aria-label="Light">
        <Icon name="sun" />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">
        <Icon name="moon" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
