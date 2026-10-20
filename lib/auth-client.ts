"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { dodopaymentsClient } from "@dodopayments/better-auth/client";

/** Browser side of Lynkr accounts. Same origin, so the session cookie goes with every request. */
export const authClient = createAuthClient({ plugins: [magicLinkClient(), dodopaymentsClient()] });

export type Account = { accounts: boolean; google: boolean; signedIn: boolean; email: string | null; subscribed: boolean };

export const NO_ACCOUNT: Account = { accounts: false, google: false, signedIn: false, email: null, subscribed: false };

export async function loadAccount(): Promise<Account> {
  try {
    const r = await fetch("/api/account", { cache: "no-store" });
    return r.ok ? ((await r.json()) as Account) : NO_ACCOUNT;
  } catch {
    return NO_ACCOUNT;
  }
}

/** Opens Dodo checkout for the signed-in account. Returns an error message, or never returns (redirects). */
export async function startCheckout(): Promise<string> {
  // Must match PLAN_SLUG in lib/auth.ts (not imported: that file is server-only).
  const { data, error } = await authClient.dodopayments.checkoutSession({ slug: "lynkr-monthly" });
  if (data?.url && data.url.startsWith("https://")) {
    window.location.assign(data.url);
    return "";
  }
  return error?.message || "Couldn't open checkout. Please try again.";
}

/** Dodo's customer portal: update card, download invoices, cancel. */
export async function openPortal(): Promise<string> {
  const { data, error } = await authClient.dodopayments.customer.portal();
  if (data?.url && data.url.startsWith("https://")) {
    window.location.assign(data.url);
    return "";
  }
  return error?.message || "Couldn't open billing. Please try again.";
}
