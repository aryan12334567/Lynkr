"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "./motion";

/**
 * The hero tagline as a poster wordmark: wide, heavy capitals sized to fill the hero's width,
 * letters rising in one after another, and the hyphen drawn in last in the accent colour.
 * Desktop sets all but the last word on one line and the last word on the next; phones set one word per line.
 * Screen readers get the tagline as written (the capitals are only CSS).
 */
export function HeroWordmark({ text }: { text: string }) {
  const box = useRef<HTMLHeadingElement>(null);
  // The landing page renders only in the browser, so the first layout can be chosen from the window up front.
  const [narrow, setNarrow] = useState(() => window.innerWidth < 592);
  const words = text.split(" ");
  const lines = narrow ? words : [words.slice(0, -1).join(" "), words[words.length - 1]].filter(Boolean);

  // Fit: measure the widest line at a reference size, then scale so it spans the container exactly.
  // (Transitions are off on the wordmark: the reduced-motion rule would otherwise animate font-size and spoil the measurement.)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const width = el.clientWidth;
      setNarrow(width < 560);
      el.style.fontSize = "100px";
      const widest = Math.max(...Array.from(el.querySelectorAll<HTMLElement>("[data-line]"), (l) => l.offsetWidth));
      if (widest > 0) el.style.fontSize = `${Math.floor((width / widest) * 100 * 0.995)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [narrow]);

  // Reveal once, on first paint (re-wrapping lines on resize must not replay it): letters rise out of
  // their line masks, then the accent hyphen draws in.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.1 });
      tl.from("[data-char]", { yPercent: 105, duration: 0.9, ease: "expo.out", stagger: 0.035 });
      tl.from("[data-mark]", { scaleX: 0, transformOrigin: "0% 50%", duration: 0.6, ease: "power3.out" }, "-=0.35");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <h1 ref={box} aria-label={text} className="w-full font-[family-name:var(--font-display)] font-[850] uppercase !leading-[0.8] !tracking-[-0.02em] [font-stretch:125%] !transition-none [&_*]:!transition-none">
      {lines.map((line, i) => (
        <span key={`${narrow}-${i}`} aria-hidden className="block overflow-hidden pb-[0.02em] pt-[0.04em]">
          <span data-line className="inline-block whitespace-nowrap">
            {Array.from(line).map((c, j) =>
              c === "-" ? (
                <span key={j} data-char className="inline-block">
                  <span data-mark className="inline-block text-accent">
                    -
                  </span>
                </span>
              ) : (
                <span key={j} data-char className="inline-block">
                  {c === " " ? " " : c}
                </span>
              ),
            )}
          </span>
        </span>
      ))}
    </h1>
  );
}
