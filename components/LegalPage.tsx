import type { ReactNode } from "react";
import Link from "next/link";
import { LegalLinks, Wordmark } from "./chrome";
import { SITE } from "@/lib/site";

/** Plain page shell for Terms, Privacy, Refunds and Contact. Server-rendered, no scripts needed. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="theme-night min-h-screen w-full bg-bg text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <header className="mb-10 flex items-center justify-between gap-3">
          <Link href="/" aria-label="Lynkr home page" className="rounded-md">
            <Wordmark />
          </Link>
          <Link href="/" className="text-[0.92rem] text-soft underline-offset-4 hover:text-ink hover:underline">
            Back to Lynkr
          </Link>
        </header>
        <main id="main" className="space-y-6 text-[1rem] leading-relaxed text-soft">
          <div>
            <h1 className="font-serif text-[2.4rem] leading-tight text-ink sm:text-[3rem]">{title}</h1>
            <p className="mt-2 text-[0.9rem] text-faint">Last updated {SITE.updated}</p>
          </div>
          {children}
        </main>
        <footer className="mt-14 border-t border-line pt-6">
          <LegalLinks />
        </footer>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-[1.45rem] text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** The published contact address, or a visible note until NEXT_PUBLIC_CONTACT_EMAIL is set at build time. */
export function ContactEmail() {
  return SITE.contactEmail ? (
    <a className="text-ink underline underline-offset-4" href={`mailto:${SITE.contactEmail}`}>
      {SITE.contactEmail}
    </a>
  ) : (
    <span className="rounded bg-marigold-wash px-1.5 text-marigold">contact email not set yet</span>
  );
}
