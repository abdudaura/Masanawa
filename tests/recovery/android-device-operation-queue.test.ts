import { describe, expect, it } from "vitest";
import type { Instant, OperationId } from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  createAndroidDeviceOperationQueue,
  type AndroidDeviceOperationExecutor,
  type AndroidDeviceOperationStore,
  type LocalDeviceOperationRecord,
  type LocalDeviceReceipt,
  type SignedDeviceOperationEnvelope,
} from "../../adapters/devices/android/src/operation-queue.js";

const tenantId = "tenant_018f6b2e-7c00-7001-8000-000000000001" as never;
const deviceId = "device_018f6b2e-7c00-7002-8000-000000000002" as never;
const authorityContextId =
  "authority-context_018f6b2e-7c00-7003-8000-000000000003" as never;
const operationId =
  "operation_018f6b2e-7c00-7004-8000-000000000004" as never;

function envelope(
  overrides: Partial<SignedDeviceOperationEnvelope> = {},
): SignedDeviceOperationEnvelope {
  const payload = { phoneNumber: "+2348012345678" };
  return {
    schemaVersion: 1,
    tenantId,
    operationId,
    authorityContextId,
    deviceId,
    capability: "telephony.call.place",
    idempotencyKey: "call-customer-001",
    payload,
    payloadHash: fingerprintCanonicalJson(payload),
    issuedAt: "2026-10-06T12:00:00.000Z" as never,
    deadlineAt: "2026-10-06T12:10:00.000Z" as never,
    signatureKeyId: "device-signing-key-v1",
    signature: "valid-signature-material",
    ...overrides,
  };
}

class DurableTestStore implements AndroidDeviceOperationStore {
  readonly records = new Map<string, LocalDeviceOperationRecord>();
  readonly idempotency = new Map<string, {
    readonly operationId: OperationId;
    readonly fingerprint: string;
  }>();

  async claim(input: { readonly record: LocalDeviceOperationRecord }) {
    const op = input.record.envelope.operationId;
    const existing = this.records.get(op);
    if (existing) {
      return { created: false, record: existing };
    }

    const key = input.record.envelope.idempotencyKey;
    const prior = this.idempotency.get(key);
    if (prior) {
      if (
        prior.operationId !== op ||
        prior.fingerprint !== input.record.envelopeFingerprint
      ) {
        throw new Error("local idempotency key already belongs to different operation");
      }
    }

    this.records.set(op, input.record);
    this.idempotency.set(key, {
      operationId: op,
      fingerprint: input.record.envelopeFingerprint,
    });
    return { created: true, record: input.record };
  }

  async claimExecution(input: { readonly operationId: OperationId; readonly at: Instant }) {
    const record = this.required(input.operationId);
    if (
      record.state === "succeeded" ||
      record.state === "failed" ||
      record.state === "unknown"
    ) {
      return { outcome: "terminal" as const, record };
    }
    if (record.state === "executing") {
      return { outcome: "already-executing" as const, record };
    }
    const next = Object.freeze({
      ...record,
      state: "executing" as const,
      updatedAt: input.at,
    });
    this.records.set(input.operationId, next);
    return { outcome: "claimed" as const, record: next };
  }

  async settle(input: {
    readonly operationId: OperationId;
    readonly expectedState: "executing";
    readonly state: "succeeded" | "failed" | "unknown";
    readonly receipt: LocalDeviceReceipt;
    readonly at: Instant;
  }) {
    const record = this.required(input.operationId);
    if (record.state !== input.expectedState) throw new Error("stale local operation state");
    const next = Object.freeze({
      ...record,
      state: input.state,
      receipt: input.receipt,
      receiptUploadState: "pending" as const,
      updatedAt: input.at,
    });
    this.records.set(input.operationId, next);
    return next;
  }

  async markUnknown(input: {
    readonly operationId: OperationId;
    readonly expectedState: "executing";
    readonly receipt: LocalDeviceReceipt;
    readonly at: Instant;
  }) {
    return this.settle({
      operationId: input.operationId,
      expectedState: input.expectedState,
      state: "unknown",
      receipt: input.receipt,
      at: input.at,
    });
  }

  async read(id: OperationId) {
    return this.records.get(id) ?? null;
  }

  async listPendingReceipts(input: { readonly limit: number }) {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.receipt !== null && record.receiptUploadState === "pending",
      )
      .slice(0, input.limit);
  }

  async acknowledgeReceipt(input: {
    readonly operationId: OperationId;
    readonly receiptId: string;
    readonly at: Instant;
  }) {
    const record = this.required(input.operationId);
    if (record.receipt === null || record.receipt.receiptId !== input.receiptId) {
      throw new Error("receipt acknowledgement mismatch");
    }
    const next = Object.freeze({
      ...record,
      receiptUploadState: "acknowledged" as const,
      updatedAt: input.at,
    });
    this.records.set(input.operationId, next);
    return next;
  }

  required(id: OperationId): LocalDeviceOperationRecord {
    const record = this.records.get(id);
    if (!record) throw new Error("operation not found");
    return record;
  }
}

function harness(input?: {
  readonly store?: DurableTestStore;
  readonly executor?: AndroidDeviceOperationExecutor;
  readonly now?: () => Instant;
}) {
  const store = input?.store ?? new DurableTestStore();
  let executions = 0;
  const executor: AndroidDeviceOperationExecutor =
    input?.executor ?? {
      async execute() {
        executions += 1;
        return {
          status: "succeeded",
          evidenceHash: "evidence-hash-001",
          evidenceRef: "local://receipt/call-001",
          observedAt: "2026-10-06T12:00:05.000Z" as never,
        };
      },
    };

  const queue = createAndroidDeviceOperationQueue({
    deviceId,
    verifier: {
      async verify(input) {
        expect(input.signingPayload).toContain(String(operationId));
        return input.signature === "valid-signature-material";
      },
    },
    store,
    executor,
    now: input?.now ?? (() => "2026-10-06T12:00:01.000Z" as never),
  });

  return {
    queue,
    store,
    executions: () => executions,
  };
}

describe("Task 125 Android DeviceOperation custody and replay", () => {
  it("accepts a valid signed operation, executes once, and replays the stored receipt", async () => {
    const h = harness();

    const accepted = await h.queue.accept(envelope());
    expect(accepted.outcome).toBe("queued");

    const completed = await h.queue.execute(operationId);
    expect(completed.state).toBe("succeeded");
    expect(completed.receipt?.outcome).toBe("succeeded");
    expect(completed.receiptUploadState).toBe("pending");
    expect(h.executions()).toBe(1);

    const replay = await h.queue.accept(envelope());
    expect(replay.outcome).toBe("replay");
    expect(replay.record.state).toBe("succeeded");

    const executedReplay = await h.queue.execute(operationId);
    expect(executedReplay.state).toBe("succeeded");
    expect(h.executions()).toBe(1);
  });

  it("rejects changed payload replay under the same Operation identity", async () => {
    const h = harness();
    await h.queue.accept(envelope());

    const changedPayload = { phoneNumber: "+2348099999999" };
    await expect(
      h.queue.accept(
        envelope({
          payload: changedPayload,
          payloadHash: fingerprintCanonicalJson(changedPayload),
        }),
      ),
    ).rejects.toThrow("replay changed signed payload");
  });

  it("rejects wrong-device, expired and invalid-signature envelopes before custody", async () => {
    const h = harness();

    await expect(
      h.queue.accept(
        envelope({
          deviceId:
            "device_018f6b2e-7c00-7999-8000-000000000999" as never,
        }),
      ),
    ).rejects.toThrow("another Device");

    const expired = harness({
      now: () => "2026-10-06T12:10:00.000Z" as never,
    });
    await expect(expired.queue.accept(envelope())).rejects.toThrow(
      "deadline expired",
    );

    await expect(
      h.queue.accept(envelope({ signature: "invalid-signature-material" })),
    ).rejects.toThrow("signature verification failed");
  });

  it("turns an interrupted executing operation into unknown after restart instead of re-executing", async () => {
    const store = new DurableTestStore();
    const first = harness({ store });
    await first.queue.accept(envelope());

    await store.claimExecution({
      operationId,
      at: "2026-10-06T12:00:02.000Z" as never,
    });

    let secondExecutions = 0;
    const restarted = harness({
      store,
      executor: {
        async execute() {
          secondExecutions += 1;
          throw new Error("must not dispatch after uncertain restart");
        },
      },
      now: () => "2026-10-06T12:00:03.000Z" as never,
    });

    const recovered = await restarted.queue.execute(operationId);
    expect(recovered.state).toBe("unknown");
    expect(recovered.receipt?.reasonCode).toBe("device.restart-inflight");
    expect(recovered.receiptUploadState).toBe("pending");
    expect(secondExecutions).toBe(0);

    await restarted.queue.execute(operationId);
    expect(secondExecutions).toBe(0);
  });

  it("records thrown executor outcomes as unknown and never blindly retries", async () => {
    let attempts = 0;
    const h = harness({
      executor: {
        async execute() {
          attempts += 1;
          throw new Error("transport died after dispatch");
        },
      },
      now: () => "2026-10-06T12:00:04.000Z" as never,
    });

    await h.queue.accept(envelope());
    const unknown = await h.queue.execute(operationId);

    expect(unknown.state).toBe("unknown");
    expect(unknown.receipt?.reasonCode).toBe("device.executor-threw");
    expect(attempts).toBe(1);

    await h.queue.execute(operationId);
    expect(attempts).toBe(1);
  });

  it("keeps offline receipts pending across queue recreation until acknowledged", async () => {
    const store = new DurableTestStore();
    const first = harness({ store });
    await first.queue.accept(envelope());
    const completed = await first.queue.execute(operationId);

    const restarted = harness({ store });
    const pending = await restarted.queue.pendingReceipts();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.receipt?.receiptId).toBe(completed.receipt?.receiptId);

    const acknowledged = await restarted.queue.acknowledgeReceipt({
      operationId,
      receiptId: completed.receipt!.receiptId,
    });
    expect(acknowledged.receiptUploadState).toBe("acknowledged");
    expect(await restarted.queue.pendingReceipts()).toEqual([]);
  });

  it("records failure-before-effect as terminal failed and safe to replay", async () => {
    let attempts = 0;
    const h = harness({
      executor: {
        async execute() {
          attempts += 1;
          return {
            status: "failed-before-effect",
            reasonCode: "device.permission-denied",
            evidenceHash: null,
            evidenceRef: null,
            observedAt: "2026-10-06T12:00:05.000Z" as never,
          };
        },
      },
    });

    await h.queue.accept(envelope());
    const failed = await h.queue.execute(operationId);
    expect(failed.state).toBe("failed");
    expect(failed.receipt?.outcome).toBe("failed");
    expect(attempts).toBe(1);

    await h.queue.execute(operationId);
    expect(attempts).toBe(1);
  });

  it("fails before dispatch when the operation deadline expires while queued", async () => {
    let attempts = 0;
    let current = "2026-10-06T12:00:01.000Z" as Instant;
    const h = harness({
      executor: {
        async execute() {
          attempts += 1;
          throw new Error("must not execute expired work");
        },
      },
      now: () => current,
    });

    await h.queue.accept(envelope());
    current = "2026-10-06T12:10:00.000Z" as never;

    const failed = await h.queue.execute(operationId);
    expect(failed.state).toBe("failed");
    expect(failed.receipt?.reasonCode).toBe(
      "device.operation-deadline-expired-before-execution",
    );
    expect(attempts).toBe(0);
  });
});
