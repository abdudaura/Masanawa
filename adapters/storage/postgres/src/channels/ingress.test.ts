import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { ChannelIngressRecord } from "@masanawa/messaging-channels";
import { createPostgresAtomicChannelIngressStore } from "./ingress.js";

const accountId = createCanonicalId("channel-account");
const receivedAt = toInstant("2026-10-06T17:30:00.000Z");

function record(
  dedupeKey: string,
  evidenceHash: string,
): ChannelIngressRecord {
  return {
    schemaVersion: 1,
    channel: "telegram",
    accountId,
    externalEventId: `event:${dedupeKey}`,
    dedupeKey,
    evidenceHash,
    receivedAt,
    event: {
      kind: "message",
      subject: {
        system: "telegram",
        namespace: "12345",
        value: "67890",
        observedAt: receivedAt,
        subjectKind: "user",
        accountId,
        authenticationStrength: "transport-verified",
      },
      conversation: {
        system: "telegram",
        namespace: "12345",
        value: "67890",
        observedAt: receivedAt,
        conversationKind: "direct",
        accountId,
      },
      messageId: dedupeKey,
      edited: false,
      content: { kind: "text", text: "hello" },
    },
  };
}

function fakePool(seed: readonly { dedupeKey: string; evidenceHash: string }[] = []) {
  const committed = new Map(
    seed.map((item) => [
      item.dedupeKey,
      { dedupe_key: item.dedupeKey, evidence_hash: item.evidenceHash },
    ]),
  );
  let tx: Map<string, { dedupe_key: string; evidence_hash: string }> | null = null;

  const client = {
    async query(sql: string, values: readonly unknown[] = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();

      if (normalized === "BEGIN") {
        tx = new Map(
          [...committed.entries()].map(([key, value]) => [key, { ...value }]),
        );
        return { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith("SET TRANSACTION ")) {
        return { rows: [], rowCount: 0 };
      }
      if (normalized === "COMMIT") {
        if (tx === null) throw new Error("transaction missing");
        committed.clear();
        for (const [key, value] of tx) committed.set(key, { ...value });
        tx = null;
        return { rows: [], rowCount: 0 };
      }
      if (normalized === "ROLLBACK") {
        tx = null;
        return { rows: [], rowCount: 0 };
      }

      const store = tx ?? committed;

      if (
        normalized.startsWith("SELECT dedupe_key, evidence_hash") &&
        normalized.includes("FROM channels.ingress_events")
      ) {
        const [dedupeKey] = values as string[];
        const row = store.get(dedupeKey);
        return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
      }

      if (normalized.startsWith("INSERT INTO channels.ingress_events")) {
        const [dedupeKey, evidenceHash] = values as string[];
        if (store.has(dedupeKey)) {
          return { rows: [], rowCount: 0 };
        }
        const row = {
          dedupe_key: dedupeKey,
          evidence_hash: evidenceHash,
        };
        store.set(dedupeKey, row);
        return { rows: [{ ...row }], rowCount: 1 };
      }

      throw new Error(`Unhandled fake SQL: ${normalized}`);
    },
    release() {},
  };

  const pool = {
    async connect() {
      return client as any;
    },
  } as unknown as Pool;

  return {
    pool,
    snapshot: () =>
      [...committed.values()]
        .map((value) => ({ ...value }))
        .sort((a, b) => a.dedupe_key.localeCompare(b.dedupe_key)),
  };
}

describe("Postgres atomic channel ingress store", () => {
  it("stores a new complete batch in input order", async () => {
    const db = fakePool();
    const store = createPostgresAtomicChannelIngressStore(db.pool);

    await expect(
      store.admitAtomic([
        record("d1", "hash-1"),
        record("d2", "hash-2"),
      ]),
    ).resolves.toEqual([
      { dedupeKey: "d1", evidenceHash: "hash-1", outcome: "stored" },
      { dedupeKey: "d2", evidenceHash: "hash-2", outcome: "stored" },
    ]);

    expect(db.snapshot()).toEqual([
      { dedupe_key: "d1", evidence_hash: "hash-1" },
      { dedupe_key: "d2", evidence_hash: "hash-2" },
    ]);
  });

  it("returns duplicate for exact durable replay", async () => {
    const db = fakePool([{ dedupeKey: "d1", evidenceHash: "hash-1" }]);
    const store = createPostgresAtomicChannelIngressStore(db.pool);

    await expect(
      store.admitAtomic([record("d1", "hash-1")]),
    ).resolves.toEqual([
      { dedupeKey: "d1", evidenceHash: "hash-1", outcome: "duplicate" },
    ]);
  });

  it("accepts a mixed duplicate and newly stored batch atomically", async () => {
    const db = fakePool([{ dedupeKey: "d1", evidenceHash: "hash-1" }]);
    const store = createPostgresAtomicChannelIngressStore(db.pool);

    await expect(
      store.admitAtomic([
        record("d1", "hash-1"),
        record("d2", "hash-2"),
      ]),
    ).resolves.toEqual([
      { dedupeKey: "d1", evidenceHash: "hash-1", outcome: "duplicate" },
      { dedupeKey: "d2", evidenceHash: "hash-2", outcome: "stored" },
    ]);

    expect(db.snapshot()).toHaveLength(2);
  });

  it("rolls back earlier inserts when a later replay key has changed evidence", async () => {
    const db = fakePool([
      { dedupeKey: "conflict", evidenceHash: "original-hash" },
    ]);
    const store = createPostgresAtomicChannelIngressStore(db.pool);

    await expect(
      store.admitAtomic([
        record("new-first", "new-hash"),
        record("conflict", "changed-hash"),
      ]),
    ).rejects.toThrow("different evidence");

    expect(db.snapshot()).toEqual([
      { dedupe_key: "conflict", evidence_hash: "original-hash" },
    ]);
  });

  it("coalesces exact duplicate keys and rejects conflicting in-batch evidence before SQL", async () => {
    const db = fakePool();
    const store = createPostgresAtomicChannelIngressStore(db.pool);

    await expect(
      store.admitAtomic([
        record("same", "hash-1"),
        record("same", "hash-1"),
      ]),
    ).resolves.toEqual([
      { dedupeKey: "same", evidenceHash: "hash-1", outcome: "stored" },
    ]);

    await expect(
      store.admitAtomic([
        record("other", "hash-a"),
        record("other", "hash-b"),
      ]),
    ).rejects.toThrow("conflicting evidence");

    expect(db.snapshot()).toEqual([
      { dedupe_key: "same", evidence_hash: "hash-1" },
    ]);
  });

  it("treats an empty batch as an empty atomic admission", async () => {
    const db = fakePool();
    const store = createPostgresAtomicChannelIngressStore(db.pool);

    await expect(store.admitAtomic([])).resolves.toEqual([]);
    expect(db.snapshot()).toEqual([]);
  });
});
