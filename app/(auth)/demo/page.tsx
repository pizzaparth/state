import type { Metadata } from "next";
import { DISPLAY } from "@/lib/type";
import { DemoStarter } from "./demo-starter";

export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

/**
 * "Take a demo": builds a throwaway workspace with sample data and opens Today. Starting
 * needs JavaScript (DemoStarter), so crawlers and link previews never create accounts.
 */
export default function DemoPage() {
  return (
    <div className="space-y-6">
      <h1 className={`${DISPLAY} text-[2rem] leading-[0.95] text-[#FFFFFF]`}>Demo</h1>
      <ul className="space-y-1 font-mono text-sm uppercase tracking-[0.12em] text-[#B4BEDB]">
        <li>60 days of sample work</li>
        <li>Edit anything</li>
        <li>Deleted on sign-out or tab close</li>
      </ul>
      <DemoStarter />
    </div>
  );
}
