"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Friendly error screen used by the route error boundaries. Reports the
// error (boundaries swallow it otherwise) and shows the digest so a user
// can quote it and we can find the event in Sentry / Vercel logs.
export function ErrorView({
  error, reset, homeHref = "/today",
}: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="error-view">
      <span className="page-icon" style={{ background: "var(--danger-subtle)", color: "var(--danger)" }}>!</span>
      <h1>Something went wrong</h1>
      <p>
        The page hit an unexpected error. It’s been reported automatically.
        Try again — if it keeps happening, send us the error ID below.
      </p>
      {error.digest && <code className="error-id">Error ID: {error.digest}</code>}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
        <Button type="button" onClick={reset}>Try again</Button>
        <Button asChild variant="outline"><Link href={homeHref}>Go to Today</Link></Button>
      </div>
    </div>
  );
}
