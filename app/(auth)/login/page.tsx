import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">
          Sign in to State
        </h1>
        <p className="text-xs text-[#A9A9A6]">
          Enter your credentials to access your execution workspace.
        </p>
      </div>

      <form className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-[#A9A9A6]"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@domain.com…"
            className="w-full h-11 px-4 text-sm bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-[border-color,box-shadow] touch-manipulation"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[#A9A9A6]"
            >
              Password
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••…"
            className="w-full h-11 px-4 text-sm bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-[border-color,box-shadow] touch-manipulation"
          />
        </div>

        <Button type="submit" variant="dark-cta" size="md" className="w-full mt-2">
          Sign In
        </Button>
      </form>

      <div className="pt-2 text-center text-xs text-[#A9A9A6]">
        <span>Don’t have an account? </span>
        <Link href="/register" className="text-white hover:underline font-medium">
          Create account
        </Link>
      </div>
    </div>
  );
}
