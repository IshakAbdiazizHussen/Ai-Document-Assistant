import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),

  async rewrites() {
    // Proxies every /api/* browser request through this Next.js server to
    // the real backend, server-to-server. The browser only ever talks to
    // its own origin — no cross-site request, so no cross-site cookie
    // problem, and no CORS preflight either (this rewrite is why
    // NEXT_PUBLIC_API_URL can be a same-origin path like "/api" instead of
    // the backend's actual URL; that real URL now lives in the
    // server-only BACKEND_API_URL instead, never shipped to the browser).
    const backendUrl = process.env.BACKEND_API_URL;
    if (!backendUrl) {
      throw new Error(
        "BACKEND_API_URL is required to proxy /api/* requests to the backend.",
      );
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
