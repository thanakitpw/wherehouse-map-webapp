import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite โหลดไฟล์ wasm ของตัวเองตอนรัน ให้ Node โหลดแพ็กเกจตรง ๆ ไม่ต้อง bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // the original HTML prototype stays reachable for the client at /prototype
  async rewrites() {
    return [{ source: "/prototype", destination: "/prototype/index.html" }];
  },
};

export default nextConfig;
