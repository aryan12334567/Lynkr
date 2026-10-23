"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, oneTapClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { dodopaymentsClient } from "@dodopayments/better-auth/client";

/** Browser side of Lynkr accounts. Same origin, so the session cookie goes with every request. */
export const authClient = createAuthClient({ plugins: [emailOTPClient(), passkeyClient(), dodopaymentsClient()] });

export type Account = {
  accounts: boolean;
  google: boolean;
  /** Public Google client ID, for One Tap. */
  googleClientId: string | null;
  apple: boolean;
  signedIn: boolean;
  email: string | null;
  subscribed: boolean;
};

export const NO_ACCOUNT: Account = { accounts: false, google: false, googleClientId: null, apple: false, signedIn: false, email: null, subscribed: false };

/** True when this browser can create and use passkeys (fingerprint, face or device PIN). */
export const passkeysSupported = (): boolean => typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";

let oneTapStarted = false;
/**
 * Google One Tap: the "Continue as …" prompt for people already signed in to Google in this browser.
 * Created on demand because the client ID comes from the server. Shown at most once per page load;
 * after a successful sign-in the page goes to `callbackURL`.
 */
export function startOneTap(clientId: string, callbackURL: string) {
  if (oneTapStarted) return;
  oneTapStarted = true;
  const client = createAuthClient({ plugins: [oneTapClient({ clientId, autoSelect: false, cancelOnTapOutside: true, context: "signin" })] });
  client.oneTap({ callbackURL }).catch(() => {});
}

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
