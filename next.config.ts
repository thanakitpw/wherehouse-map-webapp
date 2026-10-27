import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
