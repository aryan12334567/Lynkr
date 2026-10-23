"use client";

/**
 * Motion for the landing page: Lenis smooth scrolling and gentle GSAP fade-ins.
 * Pointer devices only for Lenis (phones keep native touch scrolling, which feels better).
 * Everything is skipped when the visitor asks for reduced motion, and torn down when the
 * landing page unmounts, so the app itself keeps normal scrolling.
 */
import { useEffect, type RefObject } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

let registered = false;
function register() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  registered = true;
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

/** Smooth scrolling for the lifetime of the calling component. Anchor links scroll smoothly too. */
export function useLenis() {
  useEffect(() => {
    if (prefersReducedMotion() || !finePointer()) return;
    register();
    const lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 3), anchors: { offset: -72 } });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
}

/**
 * Fade-ins inside `scope`, declared with data attributes so the markup stays readable:
 *  - data-split: a headline whose words come into focus one after another, from a slight blur
 *    (on load if data-split="load", else when it scrolls into view)
 *  - data-reveal: fades and rises a little when it scrolls into view; children with data-reveal-item stagger
 */
export function useLandingMotion(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    register();
    const splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      root.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        const split = new SplitText(el, { type: "words" });
        splits.push(split);
        const onLoad = el.dataset.split === "load";
        gsap.from(split.words, {
          opacity: 0,
          y: 10,
          filter: "blur(8px)",
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.05,
          delay: onLoad ? 0.1 : 0,
          scrollTrigger: onLoad ? undefined : { trigger: el, start: "top 85%", once: true },
          clearProps: "filter,transform,opacity",
        });
      });

      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        const items = el.querySelectorAll<HTMLElement>("[data-reveal-item]");
        const targets = items.length ? items : [el];
        gsap.from(targets, {
          y: 16,
          opacity: 0,
          duration: 0.8,
          ease: "power2.out",
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          clearProps: "transform,opacity",
        });
      });
    }, root);
    // Fonts change line breaks; measure again once they're in.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      ctx.revert();
      splits.forEach((s) => s.revert());
    };
  }, [scope]);
}
