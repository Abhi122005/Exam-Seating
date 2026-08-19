/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  experimental: {
    inlineCss: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
