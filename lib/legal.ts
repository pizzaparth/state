/**
 * Facts the legal pages depend on. One place to change them.
 * TODO(legal): confirm every value with counsel before launch — entity name, address,
 * contact mailboxes, governing law and refund position are assumptions.
 */
export const LEGAL = {
  product: "State",
  entity: "Ksan Relay",
  domain: "state.ksanrelay.in",
  contactEmail: "legal@ksanrelay.in",
  privacyEmail: "privacy@ksanrelay.in",
  securityEmail: "security@ksanrelay.in",
  governingLaw: "the laws of India",
  courts: "the courts of competent jurisdiction in India",
  effectiveDate: "28 October 2026",
} as const;

export const LEGAL_PAGES = [
  { href: "/legal/terms", title: "Terms of service" },
  { href: "/legal/privacy", title: "Privacy policy" },
  { href: "/legal/disclaimer", title: "Disclaimer" },
] as const;
