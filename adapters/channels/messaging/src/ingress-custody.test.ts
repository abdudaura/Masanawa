import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createDurableChannelIngressAdmission,
  type AtomicChannelIngressStore,
} from "./ingress-custody.js";
import type { ChannelIngressRecord } from "./model.js";

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
      content: {
        kind: "text",
        text: "hello",
      },
    },
  };
}

describe("durable channel ingress custody", () => {
  it("reports persisted when every event is newly stored", async () => {
    const store: AtomicChannelIngressStore = {
      async admitAtomic(records) {
        return records.map((item) => ({
          dedupeKey: item.dedupeKey,
          evidenceHash: item.evidenceHash,
          outcome: "stored" as const,
        }));
      },
    };

    const result = await createDurableChannelIngressAdmission({ store }).admitBatch([
      record("d1", "h1"),
      record("d2", "h2"),
    ]);

    expect(result).toEqual({ outcome: "persisted" });
  });

  it("reports duplicate when every event is an exact durable replay", async () => {
    const store: AtomicChannelIngressStore = {
      async admitAtomic(records) {
        return records.map((item) => ({
          dedupeKey: item.dedupeKey,
          evidenceHash: item.evidenceHash,
          outcome: "duplicate" as const,
        }));
      },
    };

    await expect(
      createDurableChannelIngressAdmission({ store }).admitBatch([
        record("d1", "h1"),
      ]),
    ).resolves.toEqual({ outcome: "duplicate" });
  });

  it("accepts a mixed stored/duplicate atomic batch as persisted", async () => {
    const store: AtomicChannelIngressStore = {
      async admitAtomic(records) {
        return records.map((item, index) => ({
          dedupeKey: item.dedupeKey,
          evidenceHash: item.evidenceHash,
          outcome: index === 0 ? ("duplicate" as const) : ("stored" as const),
        }));
      },
    };

    await expect(
      createDurableChannelIngressAdmission({ store }).admitBatch([
        record("d1", "h1"),
        record("d2", "h2"),
      ]),
    ).resolves.toEqual({ outcome: "persisted" });
  });

  it("coalesces exact duplicates inside one webhook batch before persistence", async () => {
    const admitAtomic = vi.fn(async (records: readonly ChannelIngressRecord[]) =>
      records.map((item) => ({
        dedupeKey: item.dedupeKey,
        evidenceHash: item.evidenceHash,
        outcome: "stored" as const,
      })),
    );
    const admission = createDurableChannelIngressAdmission({
      store: { admitAtomic },
    });

    await admission.admitBatch([
      record("d1", "h1"),
      record("d1", "h1"),
      record("d2", "h2"),
    ]);

    expect(admitAtomic).toHaveBeenCalledTimes(1);
    expect(admitAtomic.mock.calls[0]![0]).toHaveLength(2);
  });

  it("rejects conflicting evidence for one dedupe key before storage", async () => {
    const admitAtomic = vi.fn(async () => []);
    const admission = createDurableChannelIngressAdmission({
      store: { admitAtomic },
    });

    await expect(
      admission.admitBatch([
        record("d1", "h1"),
        record("d1", "changed-hash"),
      ]),
    ).rejects.toThrow(/conflicting evidence/);
    expect(admitAtomic).not.toHaveBeenCalled();
  });

  it("rejects incomplete store observations", async () => {
    const admission = createDurableChannelIngressAdmission({
      store: {
        async admitAtomic() {
          return [];
        },
      },
    });

    await expect(
      admission.admitBatch([record("d1", "h1")]),
    ).rejects.toThrow(/incomplete admission evidence/);
  });

  it("rejects store observations for another dedupe key or evidence hash", async () => {
    const wrongKey = createDurableChannelIngressAdmission({
      store: {
        async admitAtomic() {
          return [
            {
              dedupeKey: "other",
              evidenceHash: "h1",
              outcome: "stored" as const,
            },
          ];
        },
      },
    });
    await expect(
      wrongKey.admitBatch([record("d1", "h1")]),
    ).rejects.toThrow(/mismatched admission evidence/);

    const wrongHash = createDurableChannelIngressAdmission({
      store: {
        async admitAtomic() {
          return [
            {
              dedupeKey: "d1",
              evidenceHash: "other-hash",
              outcome: "stored" as const,
            },
          ];
        },
      },
    });
    await expect(
      wrongHash.admitBatch([record("d1", "h1")]),
    ).rejects.toThrow(/mismatched admission evidence/);
  });

  it("rejects duplicate observation rows from a broken store", async () => {
    const admission = createDurableChannelIngressAdmission({
      store: {
        async admitAtomic() {
          return [
            {
              dedupeKey: "d1",
              evidenceHash: "h1",
              outcome: "stored" as const,
            },
            {
              dedupeKey: "d1",
              evidenceHash: "h1",
              outcome: "duplicate" as const,
            },
          ];
        },
      },
    });

    await expect(
      admission.admitBatch([
        record("d1", "h1"),
        record("d2", "h2"),
      ]),
    ).rejects.toThrow(/duplicate observation rows/);
  });

  it("treats an empty normalized batch as a no-op duplicate", async () => {
    const admitAtomic = vi.fn(async () => []);
    const result = await createDurableChannelIngressAdmission({
      store: { admitAtomic },
    }).admitBatch([]);

    expect(result).toEqual({ outcome: "duplicate" });
    expect(admitAtomic).not.toHaveBeenCalled();
  });
});
