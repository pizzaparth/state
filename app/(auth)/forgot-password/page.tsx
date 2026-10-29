import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata = { title: "Reset password — State" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Reset your password</h1>
        <p className="text-xs text-[#A9A9A6]">Enter the email you sign in with. We will send a link to choose a new password.</p>
      </div>
      <ForgotPasswordForm />
      <div className="pt-2 text-center text-xs text-[#A9A9A6]">
        <span>Remembered it? </span>
        <Link href="/login" className="font-medium text-white hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
