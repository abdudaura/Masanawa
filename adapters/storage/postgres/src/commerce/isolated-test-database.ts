import { randomUUID } from "node:crypto";
import { Pool } from "pg";

/**
 * A disposable PostgreSQL database for a single integration suite.
 *
 * The shared CI database is used only as an administrative connection;
 * individual suites never share migration ledgers or mutable domain tables.
 * Refuse a database URL that does not name a test database.
 */
export async function createIsolatedPostgresTestDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const sourceDatabase = decodeURIComponent(url.pathname.slice(1));
  if (!/^(?:masanawa_)?test(?:_|$)|^masanawa_test$/u.test(sourceDatabase)) {
    throw new Error("Isolated integration tests require an explicit test database");
  }

  const databaseName = `masanawa_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString, max: 1 });
  try {
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
  } catch (error) {
    await admin.end();
    throw error;
  }

  url.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: url.toString() });

  return {
    pool,
    async close(): Promise<void> {
      try {
        await pool.end();
      } finally {
        try {
          await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        } finally {
          await admin.end();
        }
      }
    },
  };
}
