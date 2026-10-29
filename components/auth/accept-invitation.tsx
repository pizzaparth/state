"use client";

import * as React from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/app/(app)/actions";

/** Accept button for an invitation; opens the organisation once joined. */
export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="dark-cta"
        size="md"
        className="w-full"
        isLoading={pending}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitationAction({ token });
            if (!result.ok) return setError(result.error);
            router.replace(`/platform/org/${result.data.slug}` as Route);
          })
        }
      >
        Accept invitation
      </Button>
      <p aria-live="polite" className="min-h-5 text-sm text-[#F0A39B]">
        {error}
      </p>
    </div>
  );
}
