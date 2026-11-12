import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/marketing/json-ld";
import { COMPARISONS, getComparison } from "@/lib/compare";
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
    <article className="mx-auto w-full max-w-[1320px] px-5 pb-[16vh] pt-20 sm:px-8 lg:px-12">
      <JsonLd data={breadcrumbs} />
      <nav aria-label="Breadcrumb" className="font-mono text-sm uppercase tracking-[0.16em] text-[#71717A]">
        <Link href="/compare" className="text-accent-deep transition-colors hover:text-[#0A0A0A]">
          Compare
        </Link>
        <span aria-hidden="true"> / </span>
        <span translate="no">{c.name}</span>
      </nav>

      <h1 className="mt-6 font-sans text-[clamp(2.25rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-balance">
        <span className="text-accent-deep">State vs</span> <span translate="no">{c.name}</span>
      </h1>
      <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-[#52525B] text-pretty">{c.is}</p>

      <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-black/[0.08] bg-black/[0.08] md:grid-cols-2">
        <section aria-labelledby="pick-them" className="bg-[#F5F5F5] p-6 sm:p-8">
          <h2 id="pick-them" className="font-mono text-sm uppercase tracking-[0.16em] text-[#71717A]">
            Pick <span translate="no">{c.name}</span> if
          </h2>
          <p className="mt-4 text-xl leading-relaxed text-[#0A0A0A] text-pretty">{c.pickThem}</p>
        </section>
        <section aria-labelledby="pick-state" className="bg-[#F5F5F5] p-6 sm:p-8">
          <h2 id="pick-state" className="font-mono text-sm uppercase tracking-[0.16em] text-accent-deep">
            Pick State if
          </h2>
          <p className="mt-4 text-xl leading-relaxed text-[#0A0A0A] text-pretty">{c.pickState}</p>
        </section>
      </div>

      <section aria-labelledby="side-by-side" className="mt-20">
        <h2 id="side-by-side" className="font-sans text-[clamp(1.5rem,4vw,3rem)] font-semibold tracking-[-0.045em]">
          Side by side
        </h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-base">
            <thead>
              <tr className="border-b border-black/[0.12] font-mono text-sm uppercase tracking-[0.16em] text-[#71717A]">
                <th scope="col" className="w-1/4 py-3 pr-6 font-medium">
                  <span className="sr-only">Topic</span>
                </th>
                <th scope="col" className="py-3 pr-6 font-medium" translate="no">
                  {c.name}
                </th>
                <th scope="col" className="py-3 font-medium text-accent-deep">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map(([topic, them, state]) => (
                <tr key={topic} className="border-b border-black/[0.06] align-top">
                  <th scope="row" className="py-5 pr-6 font-semibold text-[#0A0A0A]">
                    {topic}
                  </th>
                  <td className="py-5 pr-6 text-[#52525B]">{them}</td>
                  <td className="py-5 text-[#0A0A0A]">{state}</td>
                </tr>
              ))}
              <tr className="border-b border-black/[0.06] align-top">
                <th scope="row" className="py-5 pr-6 font-semibold text-[#0A0A0A]">
                  Price
                </th>
                <td className="py-5 pr-6 text-[#52525B]">See their pricing page</td>
                <td className="py-5 text-[#0A0A0A]">Not for sale: a personal hobby project</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-16 flex flex-wrap items-center gap-3">
        <Button asChild variant="light-cta" size="lg" className="rounded-full px-7">
          <Link href="/demo" prefetch={false}>Take a demo</Link>
        </Button>
        <Button asChild variant="light-secondary" size="lg" className="rounded-full px-7">
          <Link href="/#history">See the graph</Link>
        </Button>
      </div>

      <nav aria-labelledby="more-compare" className="mt-24">
        <h2 id="more-compare" className="font-mono text-sm uppercase tracking-[0.16em] text-[#71717A]">
          More comparisons
        </h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-lg">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/compare/${o.slug}`} className="mi-underline text-[#52525B] transition-colors hover:text-[#0A0A0A]">
                State vs <span translate="no">{o.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-16 max-w-[72ch] text-sm leading-relaxed text-[#71717A]">
        <span translate="no">{c.name}</span> is a trademark of its owner and is named only to describe it. State is not affiliated with or
        endorsed by it. Descriptions reflect publicly available information as of October 2026.
      </p>
    </article>
  );
}
