import { LegalDocument, LegalList, LegalSection, Mail } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalDocument
      current="/legal/privacy"
      title="Privacy policy"
      summary={`${LEGAL.product} collects what it needs to run your account and nothing more. No advertising, no tracking pixels, no selling or sharing data for marketing, and no monitoring of keystrokes, mouse movement or time online.`}
    >
      <LegalSection id="controller" title="Who is responsible">
        <p>
          {LEGAL.entity} operates {LEGAL.product} at {LEGAL.domain} and is responsible for the personal data described here. Contact us
          at <Mail to={LEGAL.privacyEmail} />.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="What we collect">
        <LegalList
          items={[
            <>
              <strong className="font-semibold text-[#F4F4F2]">Account data:</strong> name, email address, a one-way hash of your password
              (never the password itself), timezone and preferences.
            </>,
            <>
              <strong className="font-semibold text-[#F4F4F2]">Content you create:</strong> tasks, commits, projects, tags, objectives and
              organisation membership.
            </>,
            <>
              <strong className="font-semibold text-[#F4F4F2]">Billing data:</strong> plan, subscription status, billing period and
              provider customer and subscription IDs. Card, UPI and bank details are collected by Razorpay or Stripe and never reach our
              servers.
            </>,
            <>
              <strong className="font-semibold text-[#F4F4F2]">Security data:</strong> IP address and browser user agent attached to your
              sign-in sessions, and audit records of sensitive organisation actions.
            </>,
            <>
              <strong className="font-semibold text-[#F4F4F2]">Product events:</strong> counts of actions such as “task created” used to
              understand feature use. These never include task or commit text.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="use" title="How we use it">
        <LegalList
          items={[
            "to provide the service you pay for: storing your work, calculating metrics, and showing shared work to members of your organisations;",
            "to take payment and manage your subscription;",
            "to keep accounts secure, prevent abuse and investigate incidents;",
            "to send service messages such as receipts, security notices and changes to these policies;",
            "to meet legal obligations, for example tax records.",
          ]}
        />
        <p>
          We rely on performance of our contract with you for most processing, on legitimate interests for security and aggregate product
          measurement, and on legal obligation for records we must keep. We do not use your content to train AI models.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <p>
          We set only strictly necessary cookies: a session cookie that keeps you signed in, and related security cookies. There are no
          advertising or cross-site tracking cookies, so there is no cookie banner to dismiss.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="Who we share it with">
        <p>We use a small set of processors under contract, each limited to what their service needs:</p>
        <LegalList
          items={[
            "Vercel: application hosting.",
            "Neon: managed PostgreSQL database.",
            "Razorpay and Stripe: payment processing.",
          ]}
        />
        <p>
          We will update this list before adding a processor. We disclose data to authorities only when legally required, and we never sell
          personal data.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <LegalList
          items={[
            "While your subscription is active, we keep your data so the service works.",
            "After cancellation or expiry, your account becomes read-only and your data stays exportable for 90 days, then it is deleted.",
            "Deleted tasks are soft-deleted first so you can undo, then permanently removed.",
            "Billing records are kept as long as tax law requires.",
            "Backups roll off on a fixed schedule after deletion.",
          ]}
        />
      </LegalSection>

      <LegalSection id="rights" title="Your rights">
        <p>
          Depending on where you live, including under India’s Digital Personal Data Protection Act 2023 and the EU and UK GDPR, you can
          ask to access, correct, export or erase your personal data, object to or restrict certain processing, and withdraw consent where
          we rely on it. Most of this you can do yourself in Settings; for the rest, email <Mail to={LEGAL.privacyEmail} />. We reply within
          30 days. You may also complain to your data protection authority.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Data is encrypted in transit with TLS and at rest by our database provider. Passwords are hashed, sessions use secure HTTP-only
          cookies, payment webhooks are signature-verified, and access is checked on the server for every request. No system is perfectly
          secure; if a breach affects your data we will notify you and the relevant authorities as the law requires.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="International transfers">
        <p>
          Our processors may store data outside your country. Where that happens we rely on contractual safeguards such as standard
          contractual clauses.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>{LEGAL.product} is not directed at children and we do not knowingly collect data from anyone under 18.</p>
      </LegalSection>

      <LegalSection id="changes" title="Changes">
        <p>We will post updates here and email you about material changes before they take effect.</p>
      </LegalSection>
    </LegalDocument>
  );
}
