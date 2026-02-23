import type { NextConfig } from "next";
import path from "node:path";

// ENV-based proxy target (evaluated when Next server starts):
// - Docker: set API_PROXY_TARGET=http://backend:4200 (hostname "backend" resolves on same network).
// - Local dev: set API_PROXY_TARGET=http://localhost:4200 in .env, or we fallback to it in development.
function getApiProxyTarget(): string {
  const env = process.env.API_PROXY_TARGET?.trim();
  if (env) return env;
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4200";
  }
  throw new Error(
    "API_PROXY_TARGET is required in production. " +
      "Docker: http://backend:4200 | Local: http://localhost:4200",
  );
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Closed beta: noindex in production so search engines do not index
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_BETA_MODE: process.env.BETA_MODE ?? "",
  },
  async rewrites() {
    const target = getApiProxyTarget();
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
