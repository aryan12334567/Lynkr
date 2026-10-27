import type { Metadata } from "next";
import { ContactEmail, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contact | Lynkr", description: "How to reach Lynkr for support, billing and privacy questions." };

export default function Contact() {
  return (
    <LegalPage title="Contact">
      <Section title="Support, billing and privacy">
        <p>
          Email <ContactEmail />. We aim to reply within two business days. Please write from the address you used at checkout if your question is about a payment, a cancellation or a refund, and never include
          passwords, card numbers or ID numbers.
        </p>
      </Section>
      <Section title="Who runs Lynkr">
        <p>
          Lynkr is operated by {SITE.operator}, an individual in {SITE.country}. Payments are processed by Dodo Payments, the Merchant of Record. Lynkr is not affiliated with LinkedIn.
        </p>
      </Section>
      <Section title="Useful pages">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <a className="text-ink underline underline-offset-4" href="/refunds">Refunds and cancellation</a>
          </li>
          <li>
            <a className="text-ink underline underline-offset-4" href="/terms">Terms of Service</a>
          </li>
          <li>
            <a className="text-ink underline underline-offset-4" href="/privacy">Privacy Policy</a>
          </li>
        </ul>
      </Section>
    </LegalPage>
  );
}
