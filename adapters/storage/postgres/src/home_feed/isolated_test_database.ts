import { randomUUID } from "node:crypto";
import { Pool } from "pg";

/** Real disposable database fixture. Never mutates the canonical shared
 * test database: each suite owns an isolated PG18 database and drops it. */
export async function createIsolatedPostgresTestDatabase(connectionString: string) {
  const name = "masanawa_feed_" + randomUUID().replace(/-/g, "");
  const admin = new Pool({connectionString});
  let created = false;
  try {
    await admin.query('CREATE DATABASE "' + name + '" TEMPLATE template0');
    created = true;
    const url = new URL(connectionString);
    url.pathname = "/" + name;
    const pool = new Pool({connectionString:url.toString()});
    // Wait for connections to finish their asynchronous shutdown before
    // dropping the database; FORCE would raise uncaught PG 57P01 events.
    const dropWhenIdle = async () => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const q = await admin.query<{count:string}>(
          "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname=$1",
          [name],
        );
        if (Number(q.rows[0]?.count) === 0) {
          await admin.query('DROP DATABASE IF EXISTS "' + name + '"');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error("Disposable Status PG database still has active connections");
    };
    return {
      pool,
      close: async () => {
        try { await pool.end(); }
        finally {
          try { await dropWhenIdle(); }
          finally { await admin.end(); }
        }
      },
    };
  } catch (error) {
    try {
      if (created) await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
    } finally {
      await admin.end();
    }
    throw error;
  }
}