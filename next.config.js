/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
};

module.exports = nextConfig;
