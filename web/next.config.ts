import type { NextConfig } from "next";

/**
 * The API is served from this origin, under /api, rather than called directly.
 *
 * Safari — iOS and macOS both — has blocked third-party cookies outright since
 * 13.1. Calling the API on its own domain made the session cookie third-party,
 * so Safari accepted the login response and silently dropped the cookie that
 * came with it: the account was created, and the very next request arrived
 * signed out. `SameSite=None; Secure` does not help, because that is a
 * declaration that the cookie *is* cross-site, which is precisely what Safari
 * refuses. Chrome still permits it, which is why this only ever showed on iOS.
 *
 * Proxying makes the browser talk to one origin and one origin only, so the
 * cookie is first-party and every browser keeps it. It also means the API's
 * address is no longer public.
 *
 * API_ORIGIN is server-only. NEXT_PUBLIC_API_URL is still read as a fallback so
 * an existing deployment keeps working without an env change.
 */
const API_ORIGIN = (
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
