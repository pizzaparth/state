import { ExpiredLink, ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata = { title: "Choose a new password — State" };

// Better Auth checks the emailed token at /api/auth/reset-password/:token and redirects
// here with ?token=… when it is valid, or ?error=INVALID_TOKEN when not
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(token) && !error;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-[#F4F4F2]">Choose a new password</h1>
        {valid && <p className="text-xs text-[#A9A9A6]">At least 8 characters.</p>}
      </div>
      {valid ? <ResetPasswordForm token={token} /> : <ExpiredLink />}
    </div>
  );
}
