import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Mona_Sans } from "next/font/google";
import "./globals.css";
import PostHogPageView from "@/components/PostHogPageView";

// Disable static generation for the entire app — it's fully client-rendered with localStorage
export const dynamic = "force-dynamic";

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
  description: "Write to one person on LinkedIn and sound like yourself. A LinkedIn co-pilot that drafts messages and posts from facts you confirm.",
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
        <Script
          id="ms-clarity"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "z4fk3z8waa");`,
          }}
        />
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <Script
            id="posthog"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src="https://cdn.posthog.com/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0===a&&(a={}),u._i.push([i,s,a]),u.__SV=1.0,o=0;o<e._i.length;++o)try{g(e,e._i[o][0])}catch(t){window.console&&console.log("PostHog snippet failed")}},e("${process.env.NEXT_PUBLIC_POSTHOG_KEY}","${process.env.NEXT_PUBLIC_POSTHOG_HOST}",{api_host:"${process.env.NEXT_PUBLIC_POSTHOG_HOST}"})}(document,window.posthog||[]);`,
            }}
          />
        )}
      </head>
      <body className="flex min-h-full flex-col">
        <PostHogPageView />
        {children}
      </body>
    </html>
  );
}

