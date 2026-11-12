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
    <section className="mx-auto w-full max-w-[1320px] px-5 pb-[16vh] pt-20 sm:px-8 lg:px-12">
      <h1 className="font-sans text-[clamp(2.25rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-balance">
        State vs the rest
      </h1>
      <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[#52525B]">
        Other tools organise tasks. State also measures them. Here is where each one fits.
      </p>
      <ul className="mt-16 divide-y divide-black/[0.08] border-y border-black/[0.08]">
        {COMPARISONS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/compare/${c.slug}`}
              className="mi-row group grid gap-2 px-2 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-12"
            >
              <span className="font-sans text-2xl font-semibold tracking-[-0.045em]">
                <span className="text-accent-deep">State vs</span> <span translate="no">{c.name}</span>
              </span>
              <span className="max-w-[64ch] text-lg leading-relaxed text-[#52525B]">{c.is}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-[72ch] text-sm leading-relaxed text-[#71717A]">
        Product names are trademarks of their owners and are used only to describe them. State is not affiliated with or endorsed by any of
        them.
      </p>
    </section>
  );
}
