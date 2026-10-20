import type { Metadata } from "next";
import { ContactEmail, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refunds and cancellation | Lynkr", description: "How to cancel Lynkr and when you can get a refund." };

export default function Refunds() {
  return (
    <LegalPage title="Refunds and cancellation">
      <Section title="Cancel any time">
        <p>
          You can cancel your {SITE.price} per {SITE.period} subscription whenever you like. Email <ContactEmail /> from the address you used at checkout with the subject &quot;Cancel Lynkr&quot;, and we will cancel it so
          it does not renew. After you cancel, your license key keeps working until the end of the {SITE.period} you already paid for, and you will not be charged again.
        </p>
      </Section>

      <Section title={`${SITE.refundDays}-day refund on your first payment`}>
        <p>
          If Lynkr is not right for you, ask for a refund of your first payment within {SITE.refundDays} days of paying and we will refund it in full. Email <ContactEmail /> with the address you used at checkout. Refunds go back
          to the original payment method through Dodo Payments, and how long they take to arrive depends on your bank or card issuer. A refunded subscription&apos;s license key stops working.
        </p>
      </Section>

      <Section title="Renewals">
        <p>
          Later monthly payments are not refundable once the {SITE.period} has started, except where the law requires it or you were charged in error or twice. To avoid a renewal charge, cancel before your renewal
          date.
        </p>
      </Section>

      <Section title="Failed payments">
        <p>
          If a renewal payment fails, Dodo Payments may retry it. While a payment is failing or the subscription is on hold, your license key may stop working until the payment succeeds.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Write to <ContactEmail /> and say what happened. We aim to reply within two business days.
        </p>
      </Section>
    </LegalPage>
  );
}
