import * as React from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { getViewer } from "@/lib/viewer";
import { isDemoRequest } from "@/lib/demo/mode";
import { localeFromHeader } from "@/lib/preferences";
import { PAGES } from "@/components/app/pages/registry";
import { DemoPage } from "@/components/app/demo/demo-entry";
import { PAGE_COOKIES, type PageName } from "./types";

type Params = Record<string, string | string[] | undefined>;

/** What Next passes a page. */
export interface PageProps {
  searchParams: Promise<Params>;
  params: Promise<Record<string, string>>;
}

/** One value per search param, as pages expect. */
function single(params: Params): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

/**
 * Renders a product page. The owner's page loads and renders here on the server. A demo
 * gets DemoPage, which loads and renders the same page in the browser from the demo's
 * own database; the server reads nothing for it.
 */
export async function renderPage(name: PageName, input: PageProps) {
  const [params, route] = await Promise.all([input.searchParams, input.params]);
  if (await isDemoRequest()) return <DemoPage name={name} params={single(params)} route={route} renderedAt={Date.now()} />;

  const viewer = await getViewer();
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const def = PAGES[name];
  const result = await def.load({
    viewer,
    params: single(params),
    route,
    cookies: Object.fromEntries(PAGE_COOKIES.map((c) => [c, jar.get(c)?.value])),
    browserLocale: localeFromHeader(h.get("accept-language")),
  });
  if ("redirect" in result) redirect(result.redirect as Route);
  if ("notFound" in result) notFound();
  const View = def.View;
  return <View {...result.props} />;
}
