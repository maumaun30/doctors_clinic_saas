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
  // Baseline security headers. frame-ancestors/X-Frame-Options stop other
  // sites from embedding the app (clickjacking). No full CSP yet: Next's
  // inline scripts would need nonces.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    }];
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
