/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  // No ESLint config in this project; type errors still fail the build.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
