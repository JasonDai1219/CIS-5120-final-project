import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local", "*.home.arpa", "*.lan", "192.168.*.*", "10.*.*.*"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;