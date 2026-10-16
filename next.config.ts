import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone on the same Wi-Fi open the dev server by IP,
  // e.g. LYNKR_DEV_ORIGINS=192.168.1.20 npm run dev
  allowedDevOrigins: process.env.LYNKR_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
