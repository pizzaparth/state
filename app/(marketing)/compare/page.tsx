import Link from "next/link";
import type { Metadata } from "next";
import { COMPARISONS } from "@/lib/compare";

export const metadata: Metadata = {
  title: "Notion, Trello, Todoist and Asana alternatives",
  description:
    "How State compares with Notion, Trello, Todoist, Asana, ClickUp, Jira and Linear: a to-do list and kanban app that measures finished work.",
  alternates: { canonical: "/compare" },
};

export default function ComparePage() {
  return (
    <section className="mx-auto w-full max-w-[1320px] px-5 pb-[16vh] pt-40 sm:px-8 lg:px-12">
      <h1 className="font-display text-[clamp(2.25rem,8vw,7rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] [font-stretch:125%] text-balance">
        State vs the rest
      </h1>
      <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#A9A9A6]">
        Other tools organise tasks. State also measures them. Here is where each one fits.
      </p>
      <ul className="mt-16 space-y-2 rounded-[28px] border border-white/[0.1] bg-[#0E0E0E] p-2">
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/compare/${c.slug}`}
              className="grid gap-2 rounded-[20px] border border-white/[0.16] bg-[#181818] p-6 transition-colors hover:border-accent-line hover:bg-[#202020] md:grid-cols-[16rem_minmax(0,1fr)] md:gap-12"
            >
              <span className="font-display text-2xl font-bold uppercase tracking-[-0.01em] [font-stretch:112%]">
                <span className="text-accent">State vs</span> <span translate="no">{c.name}</span>
              </span>
              <span className="max-w-[64ch] text-lg leading-relaxed text-[#A9A9A6]">{c.is}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-[72ch] text-sm leading-relaxed text-[#6F6F6B]">
        Product names are trademarks of their owners and are used only to describe them. State is not affiliated with or endorsed by any of
        them.
      </p>
    </section>
  );
}
