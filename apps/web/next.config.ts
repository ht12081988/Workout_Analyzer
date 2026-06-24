import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.ngrok-free.app'],
  async rewrites() {
    return [];
  },
};

export default nextConfig;
