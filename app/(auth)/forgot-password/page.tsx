import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { DISPLAY } from "@/lib/type";

export const metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Reset password</h1>
        <p className="text-sm text-[#A9A9A6]">We’ll email you a link.</p>
      </div>
      <ForgotPasswordForm />
      <div className="pt-2 text-center text-sm text-[#A9A9A6]">
        <span>Remembered it? </span>
        <Link href="/login" className="font-medium text-white hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
