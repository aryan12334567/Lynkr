/**
 * Facts shown on the public pages (pricing, Terms, Privacy, Refunds, Contact). Keep the site and the
 * Dodo verification form in step with these: Dodo reviews the live site against what is submitted.
 */
export const SITE = {
  name: "Lynkr",
  /** Individual who operates Lynkr (shown on Terms, Privacy and Contact). */
  operator: "Aryan Subramanya J",
  country: "India",
  /** Shown as "₹499 per month plus applicable taxes": taxes are added at checkout. */
  price: "₹499",
  period: "month",
  refundDays: 7,
  /** Set NEXT_PUBLIC_CONTACT_EMAIL at build time. The legal pages are incomplete without it. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "",
  updated: "20 October 2026",
} as const;
