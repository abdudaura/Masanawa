import {
  createPostgresPool,
  platformProductMigrationRoots,
  runMigrations,
} from "@masanawa/postgres";
import { readRequiredEnv } from "@masanawa/contracts";

const connectionString = readRequiredEnv(
  {
    DATABASE_URL:
      process.env.MASANAWA_DATABASE_URL ?? process.env.DATABASE_URL,
  },
  "DATABASE_URL",
);

const pool = createPostgresPool({
  connectionString,
  applicationName: "masanawa-gateway-migrations",
  max: 1,
});

try {
  const applied = await runMigrations(pool, platformProductMigrationRoots());
  process.stdout.write(
    `${JSON.stringify({
      event: "database.migrations.complete",
      appliedCount: applied.length,
      applied,
    })}\n`,
  );
} finally {
  await pool.end();
}
