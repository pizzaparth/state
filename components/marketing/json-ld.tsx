/**
 * Structured data for search engines. A data block, not script: the nonce CSP does not
 * apply to it. `<` is escaped so content can never close the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
