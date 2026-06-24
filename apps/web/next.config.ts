import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.ngrok-free.app'],
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:5002/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
