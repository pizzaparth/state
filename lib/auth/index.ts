import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { consumeThrottle } from "@/lib/security/throttle";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      rateLimit: schema.rateLimits,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Bounds hashing cost per request (scrypt on multi-kilobyte input is a cheap DoS)
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  // Per-IP limits, stored in Postgres so they hold across serverless instances.
  // The IP comes from x-forwarded-for, which Vercel overwrites at the edge; behind any
  // other proxy, set advanced.ipAddress.trustedProxies.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production" && (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
  },
  hooks: {
    // Per-account sign-in throttle: rotating IPs cannot bypass it (credential stuffing)
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
      if (!email) return;
      if (!(await consumeThrottle(`sign-in:${email}`, 10, 15 * 60))) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts. Try again in 15 minutes." });
      }
    }),
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },
  // Must stay last: lets Server Actions set auth cookies
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
