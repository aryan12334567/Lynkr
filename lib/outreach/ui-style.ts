// Shared class strings for the Outreach screens. Every control is at least 40 px tall (min-h-10).
export const chipCls = (on: boolean) =>
  `inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-[0.92rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${on ? "border-accent bg-accent-wash text-accent font-medium" : "border-line bg-surface text-ink hover:border-accent/50"}`;
export const linkCls = "inline-flex min-h-10 items-center text-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
export const boxCls = "rounded-xl border border-line p-4";
export const fieldCls = "min-h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-[0.95rem] text-ink focus:border-accent";
