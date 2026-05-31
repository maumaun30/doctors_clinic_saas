"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function ThemeToggle() {
  // Initial value is set pre-paint by the blocking script in app/layout.tsx.
  // We read the resulting class after mount to sync the button state.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const set = (mode: "light" | "dark") => {
    const isDark = mode === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("theme", mode);
    } catch {}
    setDark(isDark);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      <button
        type="button"
        className={dark ? "" : "on"}
        onClick={() => set("light")}
        aria-label="Light"
        aria-pressed={!dark}
      >
        <Icon name="sun" />
      </button>
      <button
        type="button"
        className={dark ? "on" : ""}
        onClick={() => set("dark")}
        aria-label="Dark"
        aria-pressed={dark}
      >
        <Icon name="moon" />
      </button>
    </div>
  );
}
