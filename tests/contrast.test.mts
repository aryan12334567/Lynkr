// Phase 4 accessibility: text colour tokens must reach WCAG AA (4.5:1) on every surface, in light and dark.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const themes = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) =>
  Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1], x[2]])),
);

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("text colours reach 4.5:1 on bg, surface and muted in both themes", () => {
  assert.equal(themes.length, 2, "expected light and dark :root blocks");
  for (const [i, t] of themes.entries()) {
    for (const fg of ["ink", "soft", "faint", "accent", "good", "warn", "bad"]) {
      for (const bg of ["bg", "surface", "muted"]) {
        const r = ratio(t[fg], t[bg]);
        assert.ok(r >= 4.5, `${i ? "dark" : "light"} ${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    }
    // Primary buttons and the active tab: text-bg on accent / accent-strong, text-bg on ink.
    for (const btn of ["accent", "accent-strong", "ink"]) {
      const r = ratio(t.bg, t[btn]);
      assert.ok(r >= 4.5, `${i ? "dark" : "light"} bg text on ${btn}: ${r.toFixed(2)}`);
    }
  }
});
