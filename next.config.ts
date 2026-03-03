import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/ep/:slug.md", destination: "/ep/:slug/md" }];
  },
};

export default nextConfig;
