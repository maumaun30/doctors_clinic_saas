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
export default nextConfig;
