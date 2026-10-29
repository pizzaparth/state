import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/marketing/json-ld";
import { COMPARISONS, getComparison } from "@/lib/compare";
import { PLANS, formatInr } from "@/lib/billing/plans";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getComparison((await params).slug);
  if (!c) return {};
  return {
    title: { absolute: `State vs ${c.name}: a ${c.query} that measures your work` },
    description: `Looking for a ${c.query}? Compare ${c.name} with State, a to-do list and kanban app that logs finished work and shows velocity, cycle time and consistency as formulas.`,
    alternates: { canonical: `/compare/${c.slug}` },
  };
}

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getComparison((await params).slug);
  if (!c) notFound();

  const others = COMPARISONS.filter((o) => o.slug !== c.slug);
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "State", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Compare", item: `${SITE_URL}/compare` },
      { "@type": "ListItem", position: 3, name: `State vs ${c.name}`, item: `${SITE_URL}/compare/${c.slug}` },
    ],
  };

  return (
    <article className="mx-auto w-full max-w-[1320px] px-5 pb-[16vh] pt-40 sm:px-8 lg:px-12">
      <JsonLd data={breadcrumbs} />
      <nav aria-label="Breadcrumb" className="font-mono text-sm uppercase tracking-[0.16em] text-[#85857F]">
        <Link href="/compare" className="transition-colors hover:text-white">
          Compare
        </Link>
        <span aria-hidden="true"> / </span>
        <span translate="no">{c.name}</span>
      </nav>

      <h1 className="mt-6 font-display text-[clamp(2.25rem,8vw,7rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] [font-stretch:125%] text-balance">
        State vs <span translate="no">{c.name}</span>
      </h1>
      <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-[#A9A9A6] text-pretty">{c.is}</p>

      <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.08] md:grid-cols-2">
        <section aria-labelledby="pick-them" className="bg-[#050505] p-6 sm:p-8">
          <h2 id="pick-them" className="font-mono text-sm uppercase tracking-[0.16em] text-[#85857F]">
            Pick <span translate="no">{c.name}</span> if
          </h2>
          <p className="mt-4 text-xl leading-relaxed text-[#F4F4F2] text-pretty">{c.pickThem}</p>
        </section>
        <section aria-labelledby="pick-state" className="bg-[#050505] p-6 sm:p-8">
          <h2 id="pick-state" className="font-mono text-sm uppercase tracking-[0.16em] text-[#85857F]">
            Pick State if
          </h2>
          <p className="mt-4 text-xl leading-relaxed text-[#F4F4F2] text-pretty">{c.pickState}</p>
        </section>
      </div>

      <section aria-labelledby="side-by-side" className="mt-20">
        <h2 id="side-by-side" className="font-display text-[clamp(1.5rem,4vw,3rem)] font-bold uppercase tracking-[-0.02em] [font-stretch:112%]">
          Side by side
        </h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-base">
            <thead>
              <tr className="border-b border-white/[0.14] font-mono text-sm uppercase tracking-[0.16em] text-[#85857F]">
                <th scope="col" className="w-1/4 py-3 pr-6 font-medium">
                  <span className="sr-only">Topic</span>
                </th>
                <th scope="col" className="py-3 pr-6 font-medium" translate="no">
                  {c.name}
                </th>
                <th scope="col" className="py-3 font-medium">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map(([topic, them, state]) => (
                <tr key={topic} className="border-b border-white/[0.08] align-top">
                  <th scope="row" className="py-5 pr-6 font-semibold text-[#F4F4F2]">
                    {topic}
                  </th>
                  <td className="py-5 pr-6 text-[#A9A9A6]">{them}</td>
                  <td className="py-5 text-[#F4F4F2]">{state}</td>
                </tr>
              ))}
              <tr className="border-b border-white/[0.08] align-top">
                <th scope="row" className="py-5 pr-6 font-semibold text-[#F4F4F2]">
                  Price
                </th>
                <td className="py-5 pr-6 text-[#A9A9A6]">See their pricing page</td>
                <td className="py-5 text-[#F4F4F2] tabular-nums">
                  From {formatInr(PLANS.individual.priceInr.monthly)}/mo, no ads
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-16 flex flex-wrap items-center gap-3">
        <Button asChild variant="dark-cta" size="lg" className="rounded-full px-7">
          <Link href="/register">Subscribe</Link>
        </Button>
        <Button asChild variant="dark-secondary" size="lg" className="rounded-full px-7">
          <Link href="/#history">See the graph</Link>
        </Button>
      </div>

      <nav aria-labelledby="more-compare" className="mt-24">
        <h2 id="more-compare" className="font-mono text-sm uppercase tracking-[0.16em] text-[#85857F]">
          More comparisons
        </h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-lg">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/compare/${o.slug}`} className="text-[#A9A9A6] underline-offset-4 transition-colors hover:text-white hover:underline">
                State vs <span translate="no">{o.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-16 max-w-[72ch] text-sm leading-relaxed text-[#6F6F6B]">
        <span translate="no">{c.name}</span> is a trademark of its owner and is named only to describe it. State is not affiliated with or
        endorsed by it. Descriptions reflect publicly available information as of October 2026.
      </p>
    </article>
  );
}
