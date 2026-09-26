import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones/laptops on the same Wi-Fi load the dev server by LAN IP
  // (IPs change between networks, so allow the private ranges).
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
};

export default nextConfig;
