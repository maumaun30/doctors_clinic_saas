"use client";

import { useEffect, useSyncExternalStore } from "react";

// The browser's install offer (Chrome/Edge/Android). It fires once, early,
// so it's caught at the root and kept here until someone clicks Install.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Registers the service worker (production only) and keeps the install offer. */
export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as InstallPrompt; emit(); };
    const onInstalled = () => { deferred = null; emit(); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

/** True when the browser offers to install the app right now. */
export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferred !== null, () => false);
}

export async function promptInstall() {
  const p = deferred;
  if (!p) return;
  deferred = null;
  emit();
  await p.prompt();
}
