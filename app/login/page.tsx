import type { Metadata } from "next";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Sign in | Lynkr" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 200) : "");
  return <AuthScreen mode="login" token={one(q.token)} linkError={one(q.error)} />;
}
