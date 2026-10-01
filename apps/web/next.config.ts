import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['@workout/shared'],
  allowedDevOrigins: ['*.ngrok-free.app'],
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
