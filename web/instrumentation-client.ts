import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry-scrub";

// Browser error monitoring. No session replay (would record patient data).
Sentry.init(sentryBaseOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
