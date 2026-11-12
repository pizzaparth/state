"use client";

import * as React from "react";
import Link from "next/link";
import { Fallback, RetryButton, fallbackSecondary } from "@/components/app/fallback";

/** A thrown query or render error inside the product. The digest goes to the console only. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("[app] page error", error.digest ?? "no digest");
  }, [error]);
  return (
    <>
      <title>Something broke — State</title>
      <Fallback label="Error" title="Something broke">
        <RetryButton onRetry={reset} />
        <Link href="/platform/today" className={fallbackSecondary}>
          Open Today
        </Link>
      </Fallback>
    </>
  );
}
