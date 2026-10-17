"use client";

import { useId } from "react";

/**
 * Hand-drawn artwork: indigo ink blooming in water, with fine threads meeting at a
 * few warm points, people connecting. Decorative only. It drifts very slowly
 * (70s cycle); reduced motion keeps it still.
 */
const THREADS = [
  "M-40 420 C 180 300, 320 520, 520 360 S 860 180, 1240 300",
  "M-40 250 C 160 330, 300 140, 520 360 S 820 520, 1240 470",
  "M120 640 C 260 470, 420 420, 520 360 S 700 120, 900 -40",
  "M300 -40 C 360 140, 460 240, 520 360 S 640 560, 760 640",
  "M-40 520 C 240 520, 600 600, 860 300 S 1100 120, 1240 140",
  "M640 -40 C 720 160, 820 220, 860 300 S 980 520, 1240 600",
];
const NODES: [number, number, number][] = [
  [520, 360, 5],
  [860, 300, 4],
  [300, 300, 2.5],
  [1040, 210, 2.5],
  [700, 520, 2],
];

export function InkThreads({ className = "", dark = true }: { className?: string; dark?: boolean }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${u}${n}`;
  const url = (n: string) => `url(#${u}${n})`;
  const thread = dark ? "rgba(214,220,255,0.55)" : "rgba(51,64,184,0.35)";
  const fade = dark ? "#0b0e24" : "#f6f7fb";
  return (
    <svg className={className} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <radialGradient id={id("a")} cx="0.45" cy="0.55" r="0.55">
          <stop offset="0" stopColor={dark ? "#3340b8" : "#c9cdf6"} stopOpacity={dark ? 0.75 : 0.9} />
          <stop offset="0.55" stopColor={dark ? "#222c78" : "#e3e6fb"} stopOpacity={dark ? 0.45 : 0.5} />
          <stop offset="1" stopColor={fade} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("b")} cx="0.7" cy="0.4" r="0.45">
          <stop offset="0" stopColor={dark ? "#5b4fd6" : "#d9d4fb"} stopOpacity={dark ? 0.5 : 0.7} />
          <stop offset="1" stopColor={fade} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("g")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f2b233" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f2b233" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("t")} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={thread} stopOpacity="0" />
          <stop offset="0.5" stopColor={thread} />
          <stop offset="1" stopColor={thread} stopOpacity="0" />
        </linearGradient>
        <filter id={id("n")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope={dark ? 0.08 : 0.05} />
          </feComponentTransfer>
        </filter>
      </defs>
      <g className="drift" style={{ transformOrigin: "50% 50%", transformBox: "fill-box" }}>
        <ellipse cx="520" cy="360" rx="560" ry="360" fill={url("a")} />
        <ellipse cx="880" cy="250" rx="420" ry="300" fill={url("b")} />
        {THREADS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={url("t")} strokeWidth={i < 2 ? 1.4 : 0.9} strokeLinecap="round" />
        ))}
        {NODES.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 7} fill={url("g")} className="node-glow" style={{ animationDelay: `${-i * 1.7}s` }} />
            <circle cx={x} cy={y} r={r} fill="#f7c65a" />
          </g>
        ))}
      </g>
      <rect width="1200" height="600" filter={url("n")} />
    </svg>
  );
}
