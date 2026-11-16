import type { Metadata } from "next";
import { ClientApp } from "@/components/ClientApp";

export const dynamic = "force-dynamic";

/** The home page is the one address for the app: #hash routes inside it are not separate pages. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <ClientApp />;
}
