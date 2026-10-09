import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "./transaction.js";

describe("repository transaction ownership", () => {
  it("keeps nested repository operations inside the outer transaction", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const connect = vi.fn(async () => client);
    const pool = { connect } as unknown as Pool;
    await withTransaction(pool, async outer => {
      await withTransaction(outer, async inner => {
        expect(inner).toBe(outer);
        await inner.query("SELECT 1");
      });
      expect(release).not.toHaveBeenCalled();
    });
    expect(query.mock.calls.map((call: unknown[]) => call[0])).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("lets the outer owner roll back a nested failure", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    await expect(withTransaction(pool, outer => withTransaction(outer, async () => {
      throw new Error("seed failed");
    }))).rejects.toThrow("seed failed");
    expect(query.mock.calls.map((call: unknown[]) => call[0])).toEqual(["BEGIN", "ROLLBACK"]);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
