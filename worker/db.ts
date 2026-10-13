import { neon } from "@neondatabase/serverless";
import { HttpError } from "./http";

/**
 * Runs one parameterised SQL statement and returns its rows.
 * Uses Neon's HTTP driver, which suits Workers: no connection pool to manage,
 * every query is a single HTTPS request.
 */
export type Sql = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

export function createSql(databaseUrl: string | undefined): Sql {
  if (!databaseUrl) {
    throw new HttpError(500, "config_error", "DATABASE_URL is not configured.");
  }

  const client = neon(databaseUrl);

  return async <T,>(text: string, params: unknown[] = []) => {
    const rows = await client.query(text, params);
    return rows as unknown as T[];
  };
}
