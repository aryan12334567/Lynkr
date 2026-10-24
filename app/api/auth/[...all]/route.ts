import { toNextJsHandler } from "better-auth/next-js";
import { accountsConfigured, getAuth } from "@/lib/auth";

export const maxDuration = 30;

/** Better Auth: sign-up, sign-in (password, email code, passkey, Google, Apple), sessions, and the Dodo checkout, portal and webhooks. */
const off = () => Response.json({ error: "Accounts aren't available right now." }, { status: 404 });

export const GET = (req: Request) => (accountsConfigured() ? toNextJsHandler(getAuth()).GET(req) : off());
export const POST = (req: Request) => (accountsConfigured() ? toNextJsHandler(getAuth()).POST(req) : off());
