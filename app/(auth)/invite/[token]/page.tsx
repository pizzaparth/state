import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/app/sign-out-button";
import { AcceptInvitation } from "@/components/auth/accept-invitation";
import { getSession } from "@/lib/auth/session";
import { findInvitation } from "@/lib/mutations";
import { acceptInvitationSchema } from "@/lib/validation";
import { DISPLAY } from "@/lib/type";

// The token is a credential: keep it out of search indexes and Referer headers
export const metadata = { title: "Invitation", robots: { index: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = acceptInvitationSchema.safeParse({ token }).success ? await findInvitation(token) : null;

  if (!invitation) {
    return (
      <div className="space-y-6">
        <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Invitation expired</h1>
        <p className="text-sm text-[#A9A9A6]">Links work once and last 7 days. Ask for a new one.</p>
        <Button asChild variant="dark-secondary" size="md" className="w-full">
          <Link href="/">Home</Link>
        </Button>
      </div>
    );
  }

  const session = await getSession();
  const here = `/invite/${token}`;
  const role = invitation.role === "admin" ? "an admin" : `a ${invitation.role}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#A9A9A6]">Invitation</p>
        <h1 className={`${DISPLAY} break-words text-[2rem] leading-[0.95] text-[#F4F4F2] text-balance`}>Join {invitation.organisationName}</h1>
        <p className="text-sm text-[#A9A9A6]">
          {invitation.inviterName} invited <span className="break-all text-[#F4F4F2]">{invitation.email}</span> as {role}.
        </p>
      </div>

      {!session ? (
        <div className="space-y-3">
          <Button asChild variant="dark-cta" size="md" className="w-full">
            <Link href={`/login?next=${encodeURIComponent(here)}` as Route}>Sign in to accept</Link>
          </Button>
          <Button asChild variant="dark-secondary" size="md" className="w-full">
            <Link href={`/register?next=${encodeURIComponent(here)}` as Route}>Create account</Link>
          </Button>
        </div>
      ) : session.user.email.toLowerCase() !== invitation.email.toLowerCase() ? (
        <div className="space-y-4">
          <p role="status" className="rounded-input border border-white/[0.1] bg-[#151515] px-4 py-3 text-sm text-[#F4F4F2]">
            Signed in as <span className="break-all">{session.user.email}</span>. Sign in with the invited address to accept.
          </p>
          <SignOutButton next={here} />
        </div>
      ) : (
        <AcceptInvitation token={token} />
      )}
    </div>
  );
}
