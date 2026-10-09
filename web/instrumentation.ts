import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry-scrub";

// Server + edge error monitoring. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
export function register() {
  Sentry.init(sentryBaseOptions);
}

// Reports errors thrown in Server Components, Route Handlers and Server Actions.
export const onRequestError = Sentry.captureRequestError;
