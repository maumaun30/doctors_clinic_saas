"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Last-resort boundary for errors in the root layout itself. Must render
// its own <html>/<body>; keep it dependency-free.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: "#6b7280" }}>The app hit an unexpected error. It’s been reported.</p>
          {error.digest && <code style={{ fontSize: 12, color: "#6b7280" }}>Error ID: {error.digest}</code>}
          <div style={{ marginTop: 16 }}>
            <button onClick={reset} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #d4d7dc", background: "#fff", cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
