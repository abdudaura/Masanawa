import type { Pool, PoolClient } from "pg";

export type TransactionIsolation =
  | "read committed"
  | "repeatable read"
  | "serializable";

export interface TransactionOptions {
  readonly isolation?: TransactionIsolation;
  readonly readOnly?: boolean;
}

export async function withTransaction<T>(
  pool: Pool | PoolClient,
  fn: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  // An existing client belongs to the outer transaction. Never commit,
  // roll back or release it from a repository operation.
  if ("release" in pool) return fn(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (options.isolation) {
      const isolation = options.isolation.toUpperCase();
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
    }
    if (options.readOnly) {
      await client.query("SET TRANSACTION READ ONLY");
    }

    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Transaction failed and rollback also failed",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

