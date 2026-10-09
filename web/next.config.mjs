// In @sentry/nextjs v11 the build wrapper lives at the /config subpath.
import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Sign-in page background photo (Unsplash License).
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  // No ESLint config in this project; type errors still fail the build.
  eslint: { ignoreDuringBuilds: true },
};
// Source maps are uploaded only when SENTRY_AUTH_TOKEN (+ org/project) is
// set, e.g. in Vercel; otherwise this just passes the config through.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
