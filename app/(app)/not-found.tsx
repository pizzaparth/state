import * as React from "react";
import Link from "next/link";
import { Fallback, ParentLink, fallbackPrimary } from "@/components/app/fallback";

export const metadata = { title: "Not found" };

/** Unknown project slug or any other missing page inside the product. */
export default function AppNotFound() {
  return (
    <Fallback label="404" title="Not found">
      <ParentLink />
      <Link href="/platform/today" className={fallbackPrimary}>
        Open Today
      </Link>
    </Fallback>
  );
}
