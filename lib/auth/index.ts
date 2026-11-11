import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * Sessions only. Nobody signs up: the owner account and demo accounts are created on the
 * server (lib/auth/owner.ts, lib/demo/session.ts), which then signs them in through
 * signInEmail with rememberMe: false. That gives a browser-session cookie (gone when the
 * browser closes) and a server session that expires after one day.
 *
 * No email, password reset, verification or social sign-in exists.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
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
    disableSignUp: true,
    requireEmailVerification: false,
    // Bounds hashing cost per request (scrypt on multi-kilobyte input is a cheap DoS)
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
  },
  // Per-IP limits, stored in Postgres so they hold across serverless instances. The IP
  // comes from x-forwarded-for, which Vercel overwrites at the edge.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 1 },
      "/request-password-reset": { window: 60 * 60, max: 1 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  // Must stay last: lets Server Actions set auth cookies
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
