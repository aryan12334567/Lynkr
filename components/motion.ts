"use client";

/**
 * Motion for the landing page: Lenis smooth scrolling and GSAP scroll animations.
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
 * Scroll and load animations inside `scope`, declared with data attributes so the markup
 * stays readable:
 *  - data-split: a headline that rises in word by word (on load if data-split="load", else on scroll)
 *  - data-reveal: fades and rises when it scrolls into view; children with data-reveal-item stagger
 *  - data-tilt: a product window that tilts upright as it scrolls into place
 *  - data-parallax="0.2": drifts slower than the page
 */
export function useLandingMotion(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    register();
    const splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      root.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
        const split = new SplitText(el, { type: "words", wordsClass: "split-word", mask: "words" });
        splits.push(split);
        const onLoad = el.dataset.split === "load";
        gsap.from(split.words, {
          yPercent: 110,
          opacity: 0,
          duration: onLoad ? 1.1 : 0.9,
          ease: "expo.out",
          stagger: 0.06,
          delay: onLoad ? 0.15 : 0,
          scrollTrigger: onLoad ? undefined : { trigger: el, start: "top 85%", once: true },
        });
      });

      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        const items = el.querySelectorAll<HTMLElement>("[data-reveal-item]");
        const targets = items.length ? items : [el];
        gsap.from(targets, {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: "top 82%", once: true },
          clearProps: "transform,opacity",
        });
      });

      root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
        gsap.fromTo(
          el,
          { rotateX: 18, scale: 0.9, y: 40, transformPerspective: 1400, transformOrigin: "50% 0%" },
          { rotateX: 0, scale: 1, y: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 95%", end: "top 25%", scrub: 0.6 } },
        );
      });

      root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const speed = Number(el.dataset.parallax) || 0.2;
        gsap.to(el, { yPercent: speed * 100, ease: "none", scrollTrigger: { trigger: el.parentElement ?? el, start: "top top", end: "bottom top", scrub: true } });
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

/** Pointer-following light on `.spot` cards (sets --mx / --my). */
export function useSpotlight(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || !finePointer()) return;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(".spot");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    root.addEventListener("pointermove", onMove);
    return () => root.removeEventListener("pointermove", onMove);
  }, [scope]);
}

/** A button that leans a few pixels toward the pointer: the primary call to action only. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.25) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !finePointer()) return;
    const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [ref, strength]);
}
