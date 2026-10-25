/**
 * Which Postgres the app talks to. Production uses DATABASE_URL from the Neon integration. Preview
 * deployments (and local development, when set) use LYNKR_DATABASE_URL, a separate Neon branch, so
 * testers never touch production data. A preview build without its own branch gets no database at
 * all: accounts and account storage switch off there instead of falling back to production.
 */
const isPreview = () => process.env.VERCEL_ENV === "preview";

export function databaseUrl(): string | undefined {
  const own = process.env.LYNKR_DATABASE_URL?.trim();
  if (own) return own;
  return isPreview() ? undefined : process.env.DATABASE_URL?.trim() || undefined;
}

/** The direct (unpooled) connection, for migrations. */
export function databaseUrlUnpooled(): string | undefined {
  const own = process.env.LYNKR_DATABASE_URL?.trim();
  if (own) return process.env.LYNKR_DATABASE_URL_UNPOOLED?.trim() || own;
  if (isPreview()) return undefined;
  return process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || undefined;
}
