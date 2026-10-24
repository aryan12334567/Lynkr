"use client";

import { Briefcase, GraduationCap, Users, type LucideIcon } from "lucide-react";
import { ACTIVE_BUCKETS, type Bucket } from "@/lib/schemas";

type ActiveBucket = (typeof ACTIVE_BUCKETS)[number];

/**
 * The buckets offered on the first screen. Data, not markup: adding the career switcher or
 * founder/freelancer bucket later is one entry here plus its questions in the bank.
 */
const OPTIONS: Record<ActiveBucket, { icon: LucideIcon; title: string; line: string }> = {
  fresher: { icon: GraduationCap, title: "Student or recent graduate", line: "Looking for a first job or internship." },
  experienced: { icon: Briefcase, title: "Experienced, looking for the next job", line: "A few years in, ready for the next role." },
  networker: { icon: Users, title: "Meeting people in my field", line: "Not job hunting right now, just building connections." },
};

/** Step one of the new interview: who is this for. Sets the questions and the wording that follow. */
export function BucketChoice({ value, onChoose }: { value: Bucket | null; onChoose: (b: ActiveBucket) => void }) {
  return (
    <section aria-labelledby="bucket-title">
      <h1 id="bucket-title" className="text-[1.75rem] leading-tight tracking-[-0.03em] sm:text-[2.1rem]">
        Which sounds most like you?
      </h1>
      <p className="mt-2 text-soft">This decides which questions you get. You can change it later.</p>
      <ul className="mt-6 grid gap-3">
        {ACTIVE_BUCKETS.map((b) => {
          const o = OPTIONS[b];
          const Icon = o.icon;
          const chosen = value === b;
          return (
            <li key={b}>
              <button
                type="button"
                onClick={() => onChoose(b)}
                aria-pressed={chosen}
                className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border bg-surface p-4 text-left transition-colors hover:border-accent/50 ${chosen ? "border-accent" : "border-line"}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-wash text-accent">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{o.title}</span>
                  <span className="mt-0.5 block text-[0.92rem] text-soft">{o.line}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
