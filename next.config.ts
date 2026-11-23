import type { NextConfig } from "next";

// Static security headers for every response. The CSP is set below for prerendered
// pages and per request (nonce) in middleware.ts for product pages.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com")',
  },
  // Razorpay Checkout may open bank/UPI windows, so popups keep their opener
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Other sites cannot embed this origin's responses (XS-Leaks, Spectre-style reads)
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

// CSP for prerendered pages (marketing, auth). A static page cannot carry a per-request
// nonce, so its own inline scripts (Next's flight data) are allowed by 'unsafe-inline'.
// These pages render no user content. Product pages (/platform) get the nonce CSP from
// middleware.ts instead.
const dev = process.env.NODE_ENV !== "production";
const staticCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Build output. A script's CSP only matters when it runs as a worker, which takes the CSP
// of its own response: the demo's database worker (lib/demo/db/worker.ts) compiles
// Postgres from WebAssembly, so it needs 'wasm-unsafe-eval' (and nothing else).
const assetCsp = ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"].join("; ");

const nextConfig: NextConfig = {
  // Optional separate output dir so a production build or test run can coexist with
  // a running `next dev` (both otherwise write to .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The demo's Postgres files (scripts/copy-pglite.mjs): the path carries the version
      { source: "/pglite/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // Everything except /platform, which middleware.ts covers with a nonce CSP, and build output
      { source: "/:path((?!platform(?:/|$)|_next/static/).*)", headers: [{ key: "Content-Security-Policy", value: staticCsp }] },
      { source: "/_next/static/:path*", headers: [{ key: "Content-Security-Policy", value: assetCsp }] },
    ];
  },
  async redirects() {
    // The landing page is served at / (see rewrites) so the root URL carries its search
    // ranking; /home links from before keep working. Product pages live under /platform
    // and old product URLs (bookmarks, emailed links) keep working.
    const moved = ["today", "inbox", "activity", "history", "metrics", "org", "settings"];
    return [
      { source: "/home", destination: "/", permanent: true },
      ...moved.flatMap((page) => [
        { source: `/${page}`, destination: `/platform/${page}`, permanent: true },
        { source: `/${page}/:path*`, destination: `/platform/${page}/:path*`, permanent: true },
      ]),
      // Projects were renamed Work and lost their list page (the sidebar lists them)
      ...["/projects", "/platform/projects"].flatMap((old) => [
        { source: old, destination: "/platform/board", permanent: true },
        { source: `${old}/:slug`, destination: "/platform/work/:slug", permanent: true },
      ]),
      { source: "/platform/work", destination: "/platform/board", permanent: false },
      // The personal board page was renamed Board
      ...["/personal", "/platform/personal"].flatMap((old) => [
        { source: old, destination: "/platform/board", permanent: true },
        { source: `${old}/:path*`, destination: "/platform/board/:path*", permanent: true },
      ]),
    ];
  },
  async rewrites() {
    // Redirects only match the incoming path, so this does not loop with /home → /
    return { beforeFiles: [{ source: "/", destination: "/home" }] };
  },
  poweredByHeader: false,
  // The demo bundles PGlite (lib/demo/db/worker.ts) for the browser. Its Node-only code
  // paths import node:* modules it never runs there: strip the scheme and stub them out.
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      }));
      config.resolve.fallback = { ...config.resolve.fallback, crypto: false, fs: false, module: false, path: false, stream: false, url: false, zlib: false };
    }
    return config;
  },
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "motion"],
    // Reuse a visited dynamic page for 30s on client navigation (Next 15 default is 0).
    // Product writes call revalidatePath() (app/(app)/actions.ts), which clears it.
    staleTimes: { dynamic: 30, static: 180 },
    // Product actions take a few hundred bytes; refuse anything near the 1 MB default
    serverActions: { bodySizeLimit: "64kb" },
  },
};

export default nextConfig;
