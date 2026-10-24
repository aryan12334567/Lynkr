/**
 * Transactional email for accounts (verify email, reset password, sign-in code) through Resend's HTTP API.
 * No SDK: one fetch. Without RESEND_API_KEY, local runs (development, or BETTER_AUTH_URL on localhost) print
 * the link or code to the server log instead; a deployed site refuses, so a sign-in never ends up only in a log.
 */
const FROM = () => process.env.EMAIL_FROM?.trim() || "Lynkr <onboarding@resend.dev>";

export const emailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY?.trim());

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The action block: a button for links, or the code itself, large and easy to copy. */
function action(kind: Kind, value: string, button: string): string {
  if (kind === "code")
    return `<p style="margin:24px 0;font-size:34px;font-weight:600;letter-spacing:8px;color:#111318;font-family:ui-monospace,Menlo,Consolas,monospace">${escape(value)}</p>`;
  return `<p style="margin:24px 0"><a href="${escape(value)}" style="background:#3a42c8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${escape(button)}</a></p>`;
}

function html(kind: Kind, heading: string, body: string, value: string, button: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;color:#111318">
<p style="font-size:22px;font-weight:600;letter-spacing:-0.5px;margin:0 0 20px">Lynkr<span style="color:#3a42c8">.</span></p>
<h1 style="font-size:20px;font-weight:600;margin:0 0 8px">${escape(heading)}</h1>
<p style="font-size:15px;line-height:1.6;color:#474c58">${escape(body)}</p>
${action(kind, value, button)}
<p style="font-size:13px;color:#5f6472">If you didn't ask for this, you can ignore this email.</p></div>`;
}

type Kind = "verify" | "reset" | "code" | "continue";

/** `value` is the link to open, or for "code" the one-time code to type in. */
export async function sendEmail(to: string, kind: Kind, value: string): Promise<void> {
  const copy = {
    verify: ["Confirm your email", "Confirm your email address to finish creating your Lynkr account.", "Confirm email", "Confirm your Lynkr email"],
    reset: ["Reset your password", "Use this link to choose a new password. It expires in one hour.", "Choose a new password", "Reset your Lynkr password"],
    continue: ["Continue on your laptop", "Open this on your laptop to import your LinkedIn PDF. The link works once and expires in 15 minutes.", "Continue on my laptop", "Continue Lynkr on your laptop"],
    code: ["Your sign-in code", "Enter this code in Lynkr to sign in. It expires in ten minutes and works once.", "", `${value} is your Lynkr sign-in code`],
  }[kind];
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    // A local production build may log links too, but only when the site itself is on localhost.
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BETTER_AUTH_URL?.trim() ?? "");
    if (process.env.NODE_ENV === "production" && !local) throw new Error("Email isn't configured.");
    console.info(`[lynkr email:${kind}] to ${to}: ${value}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM(), to: [to], subject: copy[3], html: html(kind, copy[0], copy[1], value, copy[2]) }),
  });
  // Status only: never log the address, link, code or key.
  if (!res.ok) throw new Error(`Email send failed (${res.status}).`);
}
