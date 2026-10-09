import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// This app handles medical records, so error events must never carry
// patient data. We keep the stack trace, route and an opaque user id;
// everything that could hold PHI (request bodies, query strings, cookies,
// headers, form values in breadcrumbs, emails) is dropped.

const SENSITIVE_QUERY = /([?&])[^=&#]+=[^&#]*/g;

function stripQuery(url?: string) {
  return url?.replace(SENSITIVE_QUERY, "$1[filtered]");
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    event.request.url = stripQuery(event.request.url);
  }
  if (event.user) {
    event.user = { id: event.user.id }; // never email / name / IP
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      // UI breadcrumbs can include input text; network ones include URLs with ids
      .filter(b => b.category !== "ui.input")
      .map(b => ({
        ...b,
        message: b.category === "console" ? "[console]" : b.message,
        data: b.data?.url ? { ...b.data, url: stripQuery(String(b.data.url)) } : undefined,
      }));
  }
  delete event.extra;
  return event;
}

export const sentryBaseOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0, // errors only; no performance tracing
  beforeSend: scrubEvent,
};
