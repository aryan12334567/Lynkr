import type { Metadata } from "next";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Choose a new password | Lynkr" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 200) : "");
  return <AuthScreen mode="reset" token={one(q.token)} linkError={one(q.error)} />;
}
