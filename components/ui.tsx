import type { ButtonHTMLAttributes, ReactNode } from "react";
import { parseSlots } from "@/lib/slots";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet" }) {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-[0.95rem] font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const styles = {
    primary: "bg-accent text-bg hover:bg-accent-strong",
    ghost: "border border-line bg-surface text-ink hover:border-accent/50",
    danger: "border border-line bg-surface text-bad hover:border-bad/50",
    quiet: "px-2 text-soft hover:text-ink hover:bg-muted",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

/** A panel: white on paper, hairline edge. Use for tools and forms, not for drafts. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface shadow-sm p-5 sm:p-6 ${className}`}>{children}</div>;
}

/** A section heading inside a tab, with optional one-line description. */
export function SectionHead({ title, children, level = 3, id }: { title: string; children?: ReactNode; level?: 2 | 3; id?: string }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-4">
      <H id={id} className={level === 2 ? "text-2xl font-extrabold" : "text-lg font-bold"}>
        {title}
      </H>
      {children && <p className="mt-1 max-w-[62ch] text-[0.95rem] text-soft">{children}</p>}
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 block text-[0.95rem] font-medium text-ink">
      {children}
      {hint && <span className="ml-1.5 font-normal text-faint">{hint}</span>}
    </span>
  );
}

export const inputCls =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[0.95rem] text-ink placeholder:text-faint/80 focus:border-accent";

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-[0.95rem] text-bad">
      {message}
    </p>
  );
}

/** A row of mutually exclusive pill choices (ARIA radio group). */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3.5 py-1.5 text-[0.9rem] transition-colors ${
            value === o.value ? "border-accent bg-accent text-bg" : "border-line bg-surface text-soft hover:border-accent/50 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Draft text on the sheet: blanks stay marigold until filled, then read as ink. */
export function SheetText({ body, fills, className = "" }: { body: string; fills: string[]; className?: string }) {
  return (
    <div className={`sheet ${className}`}>
      {parseSlots(body).map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (fills[s.index] ?? "").trim() ? (
          <mark key={i} className="filled">
            {fills[s.index]}
          </mark>
        ) : (
          <mark key={i} className="blank">
            {s.label}
          </mark>
        ),
      )}
    </div>
  );
}

/** Inputs for each blank in a draft. */
export function BlankInputs({ body, fills, onFill }: { body: string; fills: string[]; onFill: (f: string[]) => void }) {
  const slots = parseSlots(body).filter((s) => s.type === "slot");
  if (!slots.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slots.map((s) =>
        s.type === "slot" ? (
          <label key={s.index} className="block">
            <span className="mb-1 block text-[0.85rem] text-soft">{s.label}</span>
            <input
              className={inputCls}
              value={fills[s.index] ?? ""}
              onChange={(e) => {
                const next = [...fills];
                next[s.index] = e.target.value;
                onFill(next);
              }}
              placeholder="Your real answer"
            />
          </label>
        ) : null,
      )}
    </div>
  );
}

const TONE = {
  good: "border-good/40 bg-good/10 text-good",
  warn: "border-warn/40 bg-warn/10 text-warn",
  bad: "border-bad/40 bg-bad/10 text-bad",
  neutral: "border-line bg-muted text-soft",
  accent: "border-accent/40 bg-accent/10 text-accent",
} as const;

export function Pill({ tone = "neutral", children, className = "" }: { tone?: keyof typeof TONE; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.82rem] font-medium ${TONE[tone]} ${className}`}>{children}</span>;
}
