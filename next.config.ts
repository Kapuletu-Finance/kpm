import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image (VPS) ships the minimal standalone server; Vercel builds normally.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
