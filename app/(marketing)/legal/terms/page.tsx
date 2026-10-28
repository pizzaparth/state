import Link from "next/link";
import { LegalDocument, LegalList, LegalSection, Mail } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";
import { PLANS, formatInr } from "@/lib/billing/plans";

export const metadata = { title: "Terms of service — State" };

export default function TermsPage() {
  return (
    <LegalDocument
      current="/legal/terms"
      title="Terms of service"
      summary={`These terms govern your use of ${LEGAL.product}, a paid execution-tracking service operated by ${LEGAL.entity}. By creating an account or paying for a subscription you agree to them.`}
    >
      <LegalSection id="service" title="The service">
        <p>
          {LEGAL.product} lets you record planned work as tasks, record completed work as commits, and see metrics calculated from
          those records. Features available to you depend on your plan. We may improve or change features; we will not remove
          core functionality you have paid for during a billing period without notice.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="Accounts">
        <LegalList
          items={[
            "You must give accurate information and be old enough to form a binding contract where you live.",
            "You are responsible for activity under your account and for keeping your password secret. Tell us promptly if you suspect unauthorised access.",
            "Organisation owners are responsible for the members they invite and the roles they assign.",
          ]}
        />
      </LegalSection>

      <LegalSection id="billing" title="Subscriptions and payment">
        <LegalList
          items={[
            <>
              {LEGAL.product} is paid only. There is no free plan and no trial. Payment is taken when you subscribe, before your workspace
              is created.
            </>,
            <>
              Current prices are {formatInr(PLANS.individual.priceInr.monthly)} per month for Individual and{" "}
              {formatInr(PLANS.organisation.priceInr.monthly)} per member per month for Organisation, with yearly options. Prices shown at
              checkout, including any taxes, are the prices you pay.
            </>,
            "Subscriptions renew automatically at the end of each billing period until cancelled. Payments are processed by Razorpay (India) or Stripe (elsewhere); their terms also apply to the payment itself.",
            "You can cancel at any time. Cancellation takes effect at the end of the current paid period, and you keep access until then.",
            "Except where the law requires otherwise, payments are not refundable for partial periods.",
            "If a renewal payment fails, your account may become read-only after a grace period. Your data is preserved and remains exportable.",
            "We will give at least 30 days’ notice of a price change, which applies from your next renewal.",
          ]}
        />
      </LegalSection>

      <LegalSection id="your-data" title="Your data">
        <p>
          You own the tasks, commits, projects and other content you put into {LEGAL.product}. You grant us only the permission needed
          to store, process and display that content to provide the service to you and the people you share it with. You can export
          it as CSV or JSON at any time, including after cancellation during the retention period described in the{" "}
          <Link href="/legal/privacy" className="text-[#F4F4F2] underline underline-offset-4 hover:no-underline">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>You must not:</p>
        <LegalList
          items={[
            "access accounts, workspaces or data that are not yours, or attempt to bypass authentication, authorisation or rate limits;",
            "probe, scan or test the security of the service except under the responsible disclosure terms below;",
            "upload malware or content that is unlawful or infringes others’ rights;",
            "use the service to monitor people covertly or in breach of employment or privacy law;",
            "resell the service, or overload it through automated requests beyond normal use.",
          ]}
        />
        <p>We may suspend accounts that breach these rules, with notice where it is safe and lawful to give it.</p>
      </LegalSection>

      <LegalSection id="security" title="Responsible disclosure">
        <p>
          If you find a vulnerability, report it to <Mail to={LEGAL.securityEmail} /> with enough detail to reproduce it. Do not access
          other users’ data, degrade the service, or disclose the issue publicly before we have had a reasonable time to fix it. We will
          not pursue good-faith research that follows these rules.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="Ending the agreement">
        <p>
          You can stop using {LEGAL.product} and cancel at any time. We may end or suspend the service for you if you materially breach
          these terms or if required by law. Where we end the service for reasons other than your breach, we will refund any prepaid
          amount for the unused period.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Warranties and liability">
        <p>
          The service is provided “as is”. We work to keep it available and your data safe, but we do not promise it will be
          uninterrupted or error-free. To the extent the law allows, we are not liable for indirect or consequential loss, and our total
          liability for any claim is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits
          liability that cannot be limited by law. See also the{" "}
          <Link href="/legal/disclaimer" className="text-[#F4F4F2] underline underline-offset-4 hover:no-underline">
            disclaimer
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and governing law">
        <p>
          We may update these terms. For material changes we will notify you by email or in the product at least 30 days before they take
          effect. These terms are governed by {LEGAL.governingLaw}, and disputes are subject to {LEGAL.courts}.
        </p>
        <p>
          Questions: <Mail to={LEGAL.contactEmail} />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
