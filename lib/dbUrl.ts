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

/**
 * Settings for every pool the app opens. A connection that cannot be had in 10 seconds (a cold Neon branch, a used-up
 * pool) and a query that runs past 20 seconds fail with an error the route can answer, instead of holding the request
 * open. `query_timeout` is a timer in the client; `statement_timeout` is not used because it is sent as a startup
 * parameter, which Neon's pooled endpoint refuses.
 */
export function poolOptions(connectionString: string | undefined) {
  return { connectionString, max: 3, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, query_timeout: 20_000 };
}
