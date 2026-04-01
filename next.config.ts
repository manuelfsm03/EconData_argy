import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  generateBuildId: async () => {
    return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 12);
  },
};

export default nextConfig;
