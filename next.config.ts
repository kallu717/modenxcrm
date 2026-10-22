import type { NextConfig } from "next";

// The browser always calls the API on its own address (/api, /auth). In
// production the reverse proxy routes those paths to the Python service
// (deploy/nginx.conf). For local development, set API_ORIGIN (see
// .env.example) and Next forwards them instead, so no proxy is needed.
const apiOrigin = process.env.API_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiOrigin) return [];
    return ["api", "auth"].map((p) => ({ source: `/${p}/:path*`, destination: `${apiOrigin}/${p}/:path*` }));
  },
};

export default nextConfig;
