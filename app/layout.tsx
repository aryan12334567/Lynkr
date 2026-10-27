import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Mona_Sans } from "next/font/google";
import "./globals.css";

// Geist: one clean sans for the whole product, in two weights (400 and 600).
const sans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

// Mona Sans (GitHub's open-source typeface), wide and heavy: used only for the hero wordmark.
const display = Mona_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lynkr",
  description: "Write to one person on LinkedIn and sound like yourself. A LinkedIn co-pilot that drafts your profile, messages and posts from facts you confirm.",
  verification: {
    google: "D2FKxikgMBg1m6UZKzFROoJdya6hOau3b0hMkD-JayI",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <head>
        <Script id="clarity" strategy="beforeInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "z4fk3z8waa");`}
        </Script>
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

