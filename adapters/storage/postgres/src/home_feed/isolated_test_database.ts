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
    return {
      pool,
      close: async () => {
        try { await pool.end(); }
        finally {
          try { await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)'); }
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