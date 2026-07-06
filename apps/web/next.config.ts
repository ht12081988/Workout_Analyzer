import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['@workout/shared'],
  allowedDevOrigins: ['*.ngrok-free.app'],
  async rewrites() {
    return [];
  },
};

export default nextConfig;
