import * as React from "react";
import Link from "next/link";
import { LEGAL, LEGAL_PAGES } from "@/lib/legal";
import { cn } from "@/lib/utils";

/**
 * Shared frame for the legal pages: title, effective date, sibling navigation and a
 * readable measure. Section content is passed as children using LegalSection.
 */
export function LegalDocument({
  title,
  summary,
  current,
  children,
}: {
  title: string;
  summary: string;
  current: (typeof LEGAL_PAGES)[number]["href"];
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-[1320px] px-5 pb-[14vh] pt-36 sm:px-8 lg:px-12">
      <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            aria-current={page.href === current ? "page" : undefined}
            className={cn(
              "transition-colors",
              page.href === current ? "text-[#F4F4F2] underline underline-offset-4" : "text-[#6F6F6B] hover:text-white"
            )}
          >
            {page.title}
          </Link>
        ))}
      </nav>

      <h1 className="mt-10 font-display text-[clamp(2rem,6vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] [font-stretch:120%] text-balance">
        {title}
      </h1>
      <p className="mt-4 text-sm text-[#6F6F6B]">Effective {LEGAL.effectiveDate}</p>
      <p className="mt-8 max-w-[62ch] text-lg leading-relaxed text-[#A9A9A6]">{summary}</p>

      <div className="mt-14 max-w-[68ch] space-y-12 text-[15px] leading-relaxed text-[#C9C9C5]">{children}</div>
    </article>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold text-[#F4F4F2]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-[#6F6F6B]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Mail({ to }: { to: string }) {
  return (
    <a href={`mailto:${to}`} className="text-[#F4F4F2] underline underline-offset-4 hover:no-underline">
      {to}
    </a>
  );
}
