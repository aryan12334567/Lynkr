/**
 * Creates or updates the account tables (Better Auth: user, session, account, verification, plus the
 * dodoCustomerId column from the Dodo plugin) in the Postgres database at DATABASE_URL.
 *
 *   npm run db:migrate            apply
 *   npm run db:migrate -- --print show the SQL only
 *
 * Reads .env.local when present. Prints table names and SQL, never the connection string.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
  console.error("Set DATABASE_URL and BETTER_AUTH_SECRET first (in .env.local or the environment).");
  process.exit(1);
}

const { getAuth } = await import("../lib/auth");
const { getMigrations } = await import("better-auth/db/migration");

const plan = await getMigrations(getAuth().options);
for (const p of plan.schemaProblems) console.warn("schema:", p);
const changes = [...plan.toBeCreated.map((t) => `create ${t.table}`), ...plan.toBeAdded.map((t) => `add columns to ${t.table}: ${Object.keys(t.fields).join(", ")}`)];

if (process.argv.includes("--print")) {
  console.log((await plan.compileMigrations()) || "-- nothing to do");
} else if (!changes.length && !plan.toBeAddedIndexes.length) {
  console.log("Account tables are up to date.");
} else {
  await plan.runMigrations();
  console.log(["Applied:", ...changes, ...plan.toBeAddedIndexes.map((i) => `index ${i.name}`)].join("\n  "));
}
process.exit(0);
