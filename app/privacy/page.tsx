import type { Metadata } from "next";
import { ContactEmail, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy | Lynkr", description: "What Lynkr does with your data, in plain words." };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Lynkr is operated by {SITE.operator}, an individual in {SITE.country}. This page explains what happens to the information you give Lynkr. We aim to handle personal data in line with applicable Indian law,
        including the Digital Personal Data Protection Act, 2023.
      </p>

      <Section title="What stays in your browser">
        <p>
          Your Story Vault, drafts, weekly plan, tracker and settings are saved in your browser&apos;s local storage on your own device. Lynkr&apos;s servers do not keep a copy. &quot;Start over&quot; deletes them, and clearing
          your browser data does too. Your license key and this browser&apos;s activation id are kept in local storage as well.
        </p>
      </Section>

      <Section title="What is sent to write your drafts">
        <p>
          When you answer interview questions, confirm facts, paste a post or a job description, or upload a screenshot for Connect Coach, that text or image is sent through Lynkr&apos;s server to an AI provider
          (currently OpenAI) so it can write the reply. Lynkr does not store it, and imported profile files and pasted posts are used once and not saved. The AI provider handles that data under its own terms and privacy
          policy. Please don&apos;t enter passwords, government ID numbers, bank or card details, or other people&apos;s private information.
        </p>
      </Section>

      <Section title="Job-page import">
        <p>
          If you paste a link to a public job posting and ask Lynkr to import it, the link is sent to a scraping service (Apify) that reads that public page. Only the link is sent, and only when you use this option.
        </p>
      </Section>

      <Section title="Payments and license keys">
        <p>
          Payments are processed by Dodo Payments, the Merchant of Record. Dodo collects your payment details and email address under its own privacy policy, and Lynkr never sees your card details. When you enter a license
          key, Lynkr sends the key to Dodo to check that your subscription is active.
        </p>
      </Section>

      <Section title="Technical information">
        <p>
          Our hosting provider (Vercel) and our server record technical information such as IP address, time and the page or API requested. We use it for security, to limit abuse and to keep the service running. Lynkr does
          not use advertising or analytics cookies, and does not sell personal data.
        </p>
      </Section>

      <Section title="Who handles data for Lynkr">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>OpenAI: writes drafts from what you submit.</li>
          <li>Dodo Payments: payments, tax, invoices and license keys.</li>
          <li>Vercel: hosting.</li>
          <li>Apify: reads a public job page, only if you use the import.</li>
        </ul>
      </Section>

      <Section title="Your choices and requests">
        <p>
          You can delete your saved work at any time in the app, and you can ask us about any personal data we hold, such as emails you send us, by writing to <ContactEmail />. Lynkr is for people aged 18 and over.
        </p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes in a way that matters, the change will be visible on this page with a new date.</p>
      </Section>
    </LegalPage>
  );
}
