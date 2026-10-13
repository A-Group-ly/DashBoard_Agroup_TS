// Creates the tables and loads demo data into your Neon database.
//
//   npm run db:setup         -> db/schema.sql, then db/seed.sql
//   npm run db:seed          -> db/seed.sql only (refreshes demo dates)
//
// Reads DATABASE_URL from the environment or from .env / .dev.vars.
// You can also paste the two SQL files into the Neon SQL Editor instead.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";

for (const file of [".dev.vars", ".env"]) {
  if (!process.env.DATABASE_URL && existsSync(file)) process.loadEnvFile(file);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env (see .env.example).");
  process.exit(1);
}

// Node 22+ has a built-in WebSocket, which Neon's Pool uses.
neonConfig.webSocketConstructor = globalThis.WebSocket;

const seedOnly = process.argv.includes("--seed-only");
const files = seedOnly ? ["seed.sql"] : ["schema.sql", "seed.sql"];
const pool = new Pool({ connectionString: url });

try {
  for (const name of files) {
    const sql = readFileSync(fileURLToPath(new URL(`../db/${name}`, import.meta.url)), "utf8");
    process.stdout.write(`Running db/${name} ... `);
    const result = await pool.query(sql);
    console.log("done");

    const last = Array.isArray(result) ? result.at(-1) : result;
    if (last?.rows?.length) console.table(last.rows);
  }
  console.log("Database is ready.");
} catch (error) {
  console.error("\nDatabase setup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
