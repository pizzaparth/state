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
];

const nextConfig: NextConfig = {
  // Optional separate output dir so a production build or test run can coexist with
  // a running `next dev` (both otherwise write to .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  poweredByHeader: false,
  typedRoutes: true,
  // Billing SDKs are Node-only; keep them out of the bundler
  serverExternalPackages: ["razorpay"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
  },
};

export default nextConfig;
