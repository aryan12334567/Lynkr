import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

// Newsreader: an editorial serif with optical sizes, for headlines and every draft.
const serif = Newsreader({
  variable: "--font-martel",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

// Manrope: a crisp geometric sans for the interface.
const sans = Manrope({
  variable: "--font-mukta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lynkr",
  description: "Write to one person on LinkedIn and sound like yourself. Free for Indian freshers and early-career job seekers.",
};

export const viewport: Viewport = {
  // The whole product uses the night palette (see .theme-night in globals.css).
  themeColor: "#0a0c1f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`theme-night ${serif.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
