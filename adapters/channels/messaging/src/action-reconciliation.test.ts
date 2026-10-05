import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createChannelActionReconciler,
  normalizeChannelActionBinding,
  type ChannelActionBinding,
  type ChannelIngressRecord,
  type DurableChannelActionStore,
} from "./index.js";

const accountId = createCanonicalId("channel-account");
const requestId = createCanonicalId("request");
const receivedAt = toInstant("2026-10-05T20:00:00.000Z");

function record(input: {
  selectionId?: string;
  subject?: string;
  conversation?: string;
  receivedAt?: string;
  callbackQueryId?: string;
} = {}): ChannelIngressRecord {
  return Object.freeze({
    schemaVersion: 1,
    channel: "telegram",
    accountId,
    externalEventId: "update:42",
    dedupeKey: "dedupe-42",
    evidenceHash: "evidence-42",
    receivedAt: toInstant(input.receivedAt ?? receivedAt),
    event: Object.freeze({
      kind: "message",
      subject: Object.freeze({
        system: "telegram",
        namespace: "9001",
        value: input.subject ?? "123",
        observedAt: receivedAt,
        subjectKind: "user",
        accountId,
        authenticationStrength: "transport-verified",
      }),
      conversation: Object.freeze({
        system: "telegram",
        namespace: "9001",
        value: input.conversation ?? "123",
        observedAt: receivedAt,
        conversationKind: "direct",
        accountId,
      }),
      messageId: "15",
      edited: false,
      ...(input.callbackQueryId
        ? { callbackQueryId: input.callbackQueryId }
        : {}),
      content: Object.freeze({
        kind: "selection",
        selectionId: input.selectionId ?? "opaque-selection-1",
      }),
    }),
  });
}

function binding(overrides: Partial<ChannelActionBinding> = {}): ChannelActionBinding {
  return {
    schemaVersion: 1,
    bindingKey: "binding-1",
    channel: "telegram",
    accountId,
    selectionId: "opaque-selection-1",
    actionKey: "teaching.multiselect.toggle:stage-1",
    requestId,
    revision: 3,
    expiresAt: toInstant("2026-10-05T21:00:00.000Z"),
    subject: {
      system: "telegram",
      namespace: "9001",
      value: "123",
      subjectKind: "user",
    },
    conversation: {
      system: "telegram",
      namespace: "9001",
      value: "123",
      conversationKind: "direct",
    },
    ...overrides,
  };
}

function store(input: {
  binding?: ChannelActionBinding | null;
  outcome?: "stored" | "duplicate";
} = {}) {
  const value = input.binding === undefined ? binding() : input.binding;
  return {
    load: vi.fn(async () => value),
    admitObservation: vi.fn(async () => ({
      outcome: input.outcome ?? "stored",
      binding: value!,
    })),
  } satisfies DurableChannelActionStore;
}

describe("opaque channel action reconciliation", () => {
  it("resolves a durably admitted callback only after exact server scope checks", async () => {
    const custody = store();
    const reconciler = createChannelActionReconciler({ store: custody });
    const ingress = record({ callbackQueryId: "callback-1" });

    await expect(reconciler.resolve(ingress)).resolves.toEqual({
      actionKey: "teaching.multiselect.toggle:stage-1",
      requestId,
      revision: 3,
      bindingKey: "binding-1",
      selectionId: "opaque-selection-1",
      ingressDedupeKey: "dedupe-42",
      callbackQueryId: "callback-1",
      replay: false,
    });

    expect(custody.load).toHaveBeenCalledWith({
      channel: "telegram",
      accountId,
      selectionId: "opaque-selection-1",
    });
    expect(custody.admitObservation).toHaveBeenCalledWith({
      bindingKey: "binding-1",
      bindingRevision: 3,
      ingressDedupeKey: "dedupe-42",
      ingressEvidenceHash: "evidence-42",
      observedAt: receivedAt,
    });
  });

  it("preserves exact callback replay without minting a new RequestId", async () => {
    const custody = store({ outcome: "duplicate" });
    const result = await createChannelActionReconciler({
      store: custody,
    }).resolve(record());

    expect(result.replay).toBe(true);
    expect(result.requestId).toBe(requestId);
    expect(result.revision).toBe(3);
  });

  it.each([
    ["subject", record({ subject: "999" })],
    ["conversation", record({ conversation: "999" })],
    ["selection", record({ selectionId: "other-selection" })],
  ])("rejects %s substitution before action observation", async (_name, ingress) => {
    const custody = store();
    await expect(
      createChannelActionReconciler({ store: custody }).resolve(ingress),
    ).rejects.toMatchObject({
      code: "channels.action_scope_mismatch",
      category: "authorization",
    });
    expect(custody.admitObservation).not.toHaveBeenCalled();
  });

  it("rejects expired callbacks before action observation", async () => {
    const custody = store();
    await expect(
      createChannelActionReconciler({ store: custody }).resolve(
        record({ receivedAt: "2026-10-05T21:00:00.001Z" }),
      ),
    ).rejects.toMatchObject({
      code: "channels.action_expired",
      category: "conflict",
    });
    expect(custody.admitObservation).not.toHaveBeenCalled();
  });

  it("rejects a binding revision change that races durable observation", async () => {
    const original = binding();
    const custody: DurableChannelActionStore = {
      async load() {
        return original;
      },
      async admitObservation() {
        return {
          outcome: "stored",
          binding: {
            ...original,
            revision: original.revision + 1,
          },
        };
      },
    };

    await expect(
      createChannelActionReconciler({ store: custody }).resolve(record()),
    ).rejects.toMatchObject({
      code: "channels.action_binding_changed",
      category: "conflict",
    });
  });

  it("redacts storage failures and makes the reconciliation retryable", async () => {
    const custody: DurableChannelActionStore = {
      async load() {
        throw new Error("private database credential");
      },
      async admitObservation() {
        throw new Error("must not run");
      },
    };

    try {
      await createChannelActionReconciler({ store: custody }).resolve(record());
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: "channels.action_reconciliation_unavailable",
        category: "unavailable",
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain("credential");
    }
  });

  it("normalizes canonical binding identity and freezes nested transport scope", () => {
    const normalized = normalizeChannelActionBinding(binding());
    expect(normalized.accountId).toBe(accountId);
    expect(normalized.requestId).toBe(requestId);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.subject)).toBe(true);
    expect(Object.isFrozen(normalized.conversation)).toBe(true);
  });
});
