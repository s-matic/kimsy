import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@e965/xlsx", "mammoth", "pdf-parse"],
};

export default nextConfig;
