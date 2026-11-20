"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/app/skeletons";
import { DemoStatus } from "./demo-status";

/**
 * The demo's client entry points, split into their own chunks: PGlite, Drizzle, the
 * migrations and every page loader download only when a demo renders them, never for the
 * owner. Browser only (the server has no demo data to render).
 */
export const DemoRoot = dynamic(() => import("./demo-root").then((m) => m.DemoRoot), {
  ssr: false,
  loading: () => <DemoStatus failed={false} />,
});

export const DemoPage = dynamic(() => import("./demo-page").then((m) => m.DemoPage), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
