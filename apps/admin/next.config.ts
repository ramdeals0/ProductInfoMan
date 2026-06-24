import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@productinfoman/api-client",
    "@productinfoman/domain",
    "@productinfoman/shared",
    "@productinfoman/validation",
  ],
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
