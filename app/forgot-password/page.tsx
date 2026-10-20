import type { Metadata } from "next";
import { AuthScreen } from "@/components/AuthScreen";

export const metadata: Metadata = { title: "Reset your password | Lynkr" };

export default function ForgotPasswordPage() {
  return <AuthScreen mode="forgot" />;
}
