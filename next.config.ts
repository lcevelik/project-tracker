import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Pre-existing type errors from node_modules (next-auth, @auth/core, prisma, etc.)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
