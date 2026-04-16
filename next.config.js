/** @type {import('next').NextConfig} */
const nextConfig = {
  serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  generateBuildId: async () => null,
};

module.exports = nextConfig;
