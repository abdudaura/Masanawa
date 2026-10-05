import pg from "pg";

const connectionString =
  process.env.MASANAWA_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("MASANAWA_DATABASE_URL or DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString, max: 1 });
try {
  const result = await pool.query(
    `SELECT tenant_id
       FROM identity.tenants
      WHERE state = 'active'
      ORDER BY created_at
      LIMIT 2`,
  );
  if (result.rowCount !== 1) {
    throw new Error(
      result.rowCount === 0
        ? "No active Masanawa tenant exists"
        : "Multiple active Masanawa tenants exist; choose explicitly",
    );
  }
  process.stdout.write(result.rows[0].tenant_id);
} finally {
  await pool.end();
}
