import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.local", "*.home.arpa", "*.lan", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;