import { LegalDocument, LegalSection, Mail } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalDocument
      current="/legal/disclaimer"
      title="Disclaimer"
      summary={`${LEGAL.product} measures recorded work. It does not judge people, and its numbers are only as complete as the records behind them.`}
    >
      <LegalSection id="metrics" title="Metrics describe records, not people">
        <p>
          Execution, velocity, throughput, completion ratio, cycle time and consistency are calculated from the tasks and commits entered
          into {LEGAL.product}, using the formulas shown beside each number. They reflect only what was recorded, with the weights people
          chose. They are not a measure of anyone’s effort, ability, value or performance.
        </p>
      </LegalSection>

      <LegalSection id="employment" title="Not for employment decisions">
        <p>
          {LEGAL.product} is not designed or validated for hiring, firing, pay, promotion or disciplinary decisions, and must not be used as
          the basis for them. Organisations are responsible for using the service lawfully, including telling members how their data is
          used.
        </p>
      </LegalSection>

      <LegalSection id="advice" title="No professional advice">
        <p>
          Nothing in {LEGAL.product} or on this website is legal, financial, medical or professional advice. Decisions you make using the
          service are your own.
        </p>
      </LegalSection>

      <LegalSection id="examples" title="Examples on this website">
        <p>
          Graphs, commit histories, task names, people and figures shown on the marketing pages are illustrative sample data generated for
          demonstration. They are not real users, real customers or claims about typical results.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Availability and third parties">
        <p>
          We aim for high availability but do not guarantee it. Payment processing, hosting and database services are provided by third
          parties whose outages may affect {LEGAL.product}. Links to third-party sites are provided for convenience; we are not responsible
          for their content.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about this disclaimer: <Mail to={LEGAL.contactEmail} />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
