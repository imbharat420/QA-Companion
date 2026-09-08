import type { NextConfig } from "next";

/**
 * Static export so the Tauri Rust shell can serve the UI from disk (no Node runtime
 * in the desktop bundle). `next dev` still runs normally for browser development.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // Tauri's asset protocol has no image optimizer.
  images: { unoptimized: true },
  // Emit /runs/index.html style paths so file:// + asset protocol routing resolves.
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion", "date-fns"],
  },
};

export default nextConfig;
