"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Tags browser-side errors with an opaque user id + role (no name/email),
// so "which clinic staff hit this" is answerable without sending PII.
export function SentryUser({ id, role }: { id: string; role: string }) {
  useEffect(() => {
    Sentry.setUser({ id });
    Sentry.setTag("role", role);
    return () => { Sentry.setUser(null); };
  }, [id, role]);
  return null;
}
