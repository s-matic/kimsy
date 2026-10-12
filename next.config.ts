import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@e965/xlsx", "mammoth", "pdf-parse"],
  // pdf-parse loads its worker and @napi-rs/canvas dynamically, which the tracer misses.
  outputFileTracingIncludes: {
    "/api/**": [
      "node_modules/@napi-rs/canvas*/**/*",
      "node_modules/pdf-parse/dist/pdf-parse/{cjs,esm}/*.{cjs,mjs,js}",
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
