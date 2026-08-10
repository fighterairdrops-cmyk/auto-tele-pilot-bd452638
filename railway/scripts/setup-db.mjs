// Creates the schema on Railway Postgres:  node scripts/setup-db.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pg from "pg";

const here = dirname(new URL(import.meta.url).pathname);
const sql = readFileSync(resolve(here, "../schema.sql"), "utf8");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sslMode = (connectionString.match(/[?&]sslmode=([^&]+)/)?.[1] || process.env.PGSSLMODE || "").toLowerCase();
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])|\.railway\.internal|host=\/|@\//.test(connectionString);
const needsSsl = sslMode ? sslMode !== "disable" : !isLocal;
const client = new pg.Client({ connectionString, ssl: needsSsl ? { rejectUnauthorized: false } : false });

await client.connect();
await client.query(sql);
await client.end();
console.log("Schema applied successfully.");
