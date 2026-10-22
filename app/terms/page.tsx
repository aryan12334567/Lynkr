import type { Metadata } from "next";
import { ContactEmail, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service | Lynkr", description: "The terms for using Lynkr, a paid LinkedIn drafting tool for Indian freshers." };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms apply when you use Lynkr at lynkr.cloud. Lynkr is operated by {SITE.operator}, an individual in {SITE.country} (&quot;we&quot;, &quot;us&quot;). By subscribing or using Lynkr you agree to them. If you
        don&apos;t agree, please don&apos;t use Lynkr.
      </p>

      <Section title="1. What Lynkr is">
        <p>
          Lynkr is software that interviews you about your background and drafts LinkedIn profile text, messages, comments and posts from the facts you give it, plus a weekly plan and a message checker. You copy
          every draft and send or post it yourself. Lynkr does not log in to LinkedIn, does not post or send anything for you, and is not affiliated with or endorsed by LinkedIn.
        </p>
      </Section>

      <Section title="2. Subscription and payment">
        <p>
          Lynkr costs {SITE.price} per {SITE.period}, including applicable taxes (GST). You pay first, then use Lynkr: there is no free tier and no free trial. Payments are processed by Dodo Payments,
          which acts as the Merchant of Record for Lynkr purchases. We never receive your card details.
        </p>
        <p>
          The subscription renews every {SITE.period} until you cancel. If we change the price, the change applies from your next renewal and we will tell you before it takes effect. See{" "}
          <a className="text-ink underline underline-offset-4" href="/refunds">Refunds and cancellation</a> for how to cancel and when you can get a refund.
        </p>
      </Section>

      <Section title="3. Your license key">
        <p>
          After you subscribe, Dodo Payments emails you a license key. You enter it in Lynkr to unlock access. The key is for your own use, works in a limited number of browsers, and must not be shared, sold or posted
          publicly. A key stops working when the subscription is cancelled or ends, when a payment fails, or after a refund. We may disable a key that is shared or misused.
        </p>
      </Section>

      <Section title="4. Using Lynkr properly">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Give Lynkr only facts that are true about you. You are responsible for everything you send or post, and for checking each draft before you do.</li>
          <li>Don&apos;t use Lynkr for spam, mass outreach, impersonation, harassment, scraping, or anything that breaks the law or LinkedIn&apos;s rules.</li>
          <li>Don&apos;t try to get around the subscription, copy the service, or put an unreasonable load on it.</li>
          <li>Don&apos;t enter other people&apos;s private information, passwords or financial details.</li>
        </ul>
      </Section>

      <Section title="5. AI drafts">
        <p>
          Drafts are written by an AI model from what you provide. They can contain mistakes or miss context, so read and edit them. Lynkr does not promise replies, interviews, referrals or jobs, and the message checker
          is a rule-based aid, not a guarantee that a message will work.
        </p>
      </Section>

      <Section title="6. Your content and data">
        <p>
          What you type is yours. Your Story Vault, drafts and plan are kept in your browser. To write drafts, what you enter is sent through our server to an AI provider and is not stored by Lynkr. The{" "}
          <a className="text-ink underline underline-offset-4" href="/privacy">Privacy Policy</a> explains this in detail.
        </p>
      </Section>

      <Section title="7. Availability and changes">
        <p>
          Lynkr is provided &quot;as is&quot; and may change, pause or have errors from time to time. We may update these terms; if a change matters to you we will make it visible on this page, and continuing to use Lynkr after
          that means you accept it.
        </p>
      </Section>

      <Section title="8. Limits on our liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses, including lost opportunities, and our total liability for any claim is limited to the amount you paid for Lynkr in the three
          months before the claim. Nothing here limits rights you have under law that cannot be excluded.
        </p>
      </Section>

      <Section title="9. Governing law">
        <p>These terms are governed by the laws of {SITE.country}.</p>
      </Section>

      <Section title="10. Contact">
        <p>
          Questions about these terms: <ContactEmail />.
        </p>
      </Section>
    </LegalPage>
  );
}
