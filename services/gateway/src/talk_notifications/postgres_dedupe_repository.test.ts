import { describe, expect, it } from "vitest";
import {
  createPostgresTalkPushDedupeRepository,
  type TalkPushDedupeSqlPool,
} from "./postgres_dedupe_repository.js";

describe("Postgres Talk push dedupe", () => {
  it("claims the first delivery and rejects an idempotent retry", async () => {
    const seen = new Set<string>();
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkPushDedupeSqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        const key = String(values?.slice(0, 3).join("|"));
        if (seen.has(key)) {
          return { rowCount: 0, rows: [] as unknown as Row[] };
        }
        seen.add(key);
        return {
          rowCount: 1,
          rows: [{ dedupe_key: values?.[2] }] as unknown as Row[],
        };
      },
    };
    const repository = createPostgresTalkPushDedupeRepository(pool);
    const claim = {
      tenantId: "tenant_1",
      userId: "user_1",
      dedupeKey: "talk-push:v1:tenant_1:user_1:event_1",
      createdAt: "2026-10-07T12:00:00.000Z",
    };

    await expect(repository.claim(claim)).resolves.toBe(true);
    await expect(repository.claim(claim)).resolves.toBe(false);

    expect(calls[0]?.text).toContain(
      "ON CONFLICT (tenant_id, user_id, dedupe_key) DO NOTHING",
    );
    expect(calls[0]?.values).toEqual([
      "tenant_1",
      "user_1",
      "talk-push:v1:tenant_1:user_1:event_1",
      "2026-10-07T12:00:00.000Z",
    ]);
  });
});
