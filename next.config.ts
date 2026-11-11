import type { NextConfig } from "next";

// Static security headers for every response. The CSP is per-request (nonce) and set
// in middleware.ts.
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

const nextConfig: NextConfig = {
  // Optional separate output dir so a production build or test run can coexist with
  // a running `next dev` (both otherwise write to .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // The landing page is served at / (see rewrites) so the root URL carries its search
    // ranking; /home links from before keep working. Product pages live under /platform
    // and old product URLs (bookmarks, emailed links) keep working.
    const moved = ["today", "inbox", "activity", "history", "metrics", "personal", "projects", "org", "settings"];
    return [
      { source: "/home", destination: "/", permanent: true },
      ...moved.flatMap((page) => [
        { source: `/${page}`, destination: `/platform/${page}`, permanent: true },
        { source: `/${page}/:path*`, destination: `/platform/${page}/:path*`, permanent: true },
      ]),
    ];
  },
  async rewrites() {
    // Redirects only match the incoming path, so this does not loop with /home → /
    return { beforeFiles: [{ source: "/", destination: "/home" }] };
  },
  poweredByHeader: false,
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
