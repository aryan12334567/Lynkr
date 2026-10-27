/**
 * Creates or updates the database tables:
 *  1. Better Auth's account tables (user, session, account, verification, passkey, plus dodoCustomerId), then
 *  2. Lynkr's versioned SQL migrations in scripts/migrations (001_*.sql, 002_*.sql ...), each applied once and
 *     recorded in lynkr_migrations. Every file is written to be safe to run again.
 *
 *   npm run db:migrate            apply
 *   npm run db:migrate -- --print show what would change, change nothing
 *
 * Uses the direct connection from lib/dbUrl.ts (LYNKR_DATABASE_URL_UNPOOLED for a preview branch, else
 * DATABASE_URL_UNPOOLED): migrations need a direct session.
 * Reads .env.local when present. Prints table names, file names and SQL, never the connection string.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { databaseUrlUnpooled } = await import("../lib/dbUrl");
const target = databaseUrlUnpooled();
if (!target || !process.env.BETTER_AUTH_SECRET) {
  console.error("Set a database (DATABASE_URL, or LYNKR_DATABASE_URL for a preview branch) and BETTER_AUTH_SECRET first.");
  process.exit(1);
}
// Better Auth and the SQL migrations below must hit the same database: pin both to the direct connection.
process.env.LYNKR_DATABASE_URL = target;
process.env.DATABASE_URL = target;
const print = process.argv.includes("--print");
console.log(`Database host: ${new URL(target).hostname.replace(/^[^.]+/, "***")}${print ? " (print only)" : ""}`);

// 1. Better Auth
const { getAuth } = await import("../lib/auth");
const { getMigrations } = await import("better-auth/db/migration");
const plan = await getMigrations(getAuth().options);
for (const p of plan.schemaProblems) console.warn("schema:", p);
const changes = [...plan.toBeCreated.map((t) => `create ${t.table}`), ...plan.toBeAdded.map((t) => `add columns to ${t.table}: ${Object.keys(t.fields).join(", ")}`)];
if (print) console.log((await plan.compileMigrations()) || "-- Better Auth: nothing to do");
else if (!changes.length && !plan.toBeAddedIndexes.length) console.log("Account tables are up to date.");
else {
  await plan.runMigrations();
  console.log(["Applied:", ...changes, ...plan.toBeAddedIndexes.map((i) => `index ${i.name}`)].join("\n  "));
}

// 2. Lynkr SQL migrations
const dir = join(import.meta.dirname, "migrations");
const files = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  // --print changes nothing, not even the bookkeeping table.
  const hasTable = (await client.query<{ t: string | null }>("select to_regclass('public.lynkr_migrations')::text as t")).rows[0].t !== null;
  if (!hasTable && !print) await client.query("create table lynkr_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set(hasTable ? (await client.query<{ name: string }>("select name from lynkr_migrations")).rows.map((r) => r.name) : []);
  const pending = files.filter((f) => !done.has(f));
  if (!pending.length) console.log("Lynkr tables are up to date.");
  for (const f of pending) {
    const sql = readFileSync(join(dir, f), "utf8");
    if (print) {
      console.log(`-- pending: ${f}\n${sql}`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into lynkr_migrations (name) values ($1) on conflict do nothing", [f]);
      await client.query("commit");
      console.log(`Applied: ${f}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
} finally {
  await client.end();
}
process.exit(0);
