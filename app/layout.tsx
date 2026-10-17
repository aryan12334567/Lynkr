import type { Metadata } from "next";
import { Martel, Mukta } from "next/font/google";
import "./globals.css";

const martel = Martel({
  variable: "--font-martel",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Lynkr",
  description: "Write to one person on LinkedIn and sound like yourself. Free for Indian freshers and early-career job seekers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${martel.variable} ${mukta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
