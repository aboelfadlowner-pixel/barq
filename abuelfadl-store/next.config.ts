import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Development only. Without this, Next.js blocks the dev server's JavaScript when the page is opened
   * from another device (e.g. the phone via http://192.168.x.x:3000): the page renders but nothing is
   * interactive. "*.*.*.*" allows any IPv4 address (home Wi-Fi, office, phone hotspot); "*.local" allows names like my-pc.local.
   * Has no effect on `next build` / production (Vercel).
   */
  allowedDevOrigins: ["*.*.*.*", "*.local"],
};

export default nextConfig;
