/**
 * Transactional email for accounts (verify email, reset password, magic link) through Resend's HTTP API.
 * No SDK: one fetch. Without RESEND_API_KEY, local runs (development, or BETTER_AUTH_URL on localhost) print
 * the link to the server log instead; a deployed site refuses, so a sign-in link never ends up only in a log.
 */
const FROM = () => process.env.EMAIL_FROM?.trim() || "Lynkr <onboarding@resend.dev>";

export const emailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY?.trim());

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function html(heading: string, body: string, url: string, button: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1330">
<p style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px">Lynkr<span style="color:#f2b233">.</span></p>
<h1 style="font-size:20px;margin:0 0 8px">${escape(heading)}</h1>
<p style="font-size:15px;line-height:1.6;color:#444a68">${escape(body)}</p>
<p style="margin:24px 0"><a href="${escape(url)}" style="background:#3340b8;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${escape(button)}</a></p>
<p style="font-size:13px;color:#545a79">If you didn't ask for this, you can ignore this email.</p></div>`;
}

export async function sendEmail(to: string, kind: "verify" | "reset" | "magic", url: string): Promise<void> {
  const copy = {
    verify: ["Confirm your email", "Confirm your email address to finish creating your Lynkr account.", "Confirm email", "Confirm your Lynkr email"],
    reset: ["Reset your password", "Use this link to choose a new password. It expires in one hour.", "Choose a new password", "Reset your Lynkr password"],
    magic: ["Your sign-in link", "Use this link to sign in to Lynkr. It expires in five minutes and works once.", "Sign in to Lynkr", "Your Lynkr sign-in link"],
  }[kind];
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    // A local production build may log links too, but only when the site itself is on localhost.
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BETTER_AUTH_URL?.trim() ?? "");
    if (process.env.NODE_ENV === "production" && !local) throw new Error("Email isn't configured.");
    console.info(`[lynkr email:${kind}] to ${to}: ${url}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: [to], subject: copy[3], html: html(copy[0], copy[1], url, copy[2]) }),
  });
  // Status only: never log the address, link or key.
  if (!res.ok) throw new Error(`Email send failed (${res.status}).`);
}
