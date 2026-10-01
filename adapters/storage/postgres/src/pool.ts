import { Pool, type PoolConfig } from "pg";

export interface PostgresPoolOptions {
  readonly connectionString: string;
  readonly applicationName: string;
  readonly max?: number;
  readonly idleTimeoutMs?: number;
  readonly connectionTimeoutMs?: number;
  readonly ssl?: PoolConfig["ssl"];
}

export function createPostgresPool(options: PostgresPoolOptions): Pool {
  if (!options.connectionString.trim()) {
    throw new TypeError("PostgreSQL connection string is required");
  }
  if (!options.applicationName.trim()) {
    throw new TypeError("PostgreSQL application name is required");
  }

  return new Pool({
    connectionString: options.connectionString,
    application_name: options.applicationName,
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    ...(options.ssl === undefined ? {} : { ssl: options.ssl }),
  });
}
