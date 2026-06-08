import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.ngrok-free.app'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5002/:path*',
      },
    ];
  },
};

export default nextConfig;
