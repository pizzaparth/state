import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">
          Create your State account
        </h1>
        <p className="text-xs text-[#A9A9A6]">
          Start measuring your personal and team output with precision.
        </p>
      </div>

      <form className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="name"
            className="block text-xs font-medium text-[#A9A9A6]"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Ada Lovelace…"
            className="w-full h-11 px-4 text-sm bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-all touch-manipulation"
          />
        </div>

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
            className="w-full h-11 px-4 text-sm bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-all touch-manipulation"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-[#A9A9A6]"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="••••••••…"
            className="w-full h-11 px-4 text-sm bg-[#151515] text-[#F4F4F2] rounded-input border border-white/[0.1] focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 placeholder:text-[#6F6F6B] transition-all touch-manipulation"
          />
        </div>

        <Button type="submit" variant="dark-cta" size="md" className="w-full mt-2">
          Create Account
        </Button>
      </form>

      <div className="pt-2 text-center text-xs text-[#A9A9A6]">
        <span>Already have an account? </span>
        <Link href="/login" className="text-white hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}
