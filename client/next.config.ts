import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) {
      throw new Error(
        "API_PROXY_TARGET is required. Set it in .env (local) or docker-compose (Docker). " +
          "Local: http://localhost:4200 | Docker: http://backend:4200",
      );
    }
    return [
      {
        source: "/api/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@"] = path.resolve(process.cwd(), "src");
    return config;
  },
};

export default nextConfig;
