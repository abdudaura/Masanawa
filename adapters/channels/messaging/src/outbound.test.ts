import {
  createCanonicalId,
  toInstant,
  type Instant,
  type RequestId,
} from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createChannelOutboundDispatcher,
  fingerprintChannelOutboundRequest,
  normalizeChannelOutboundRequest,
  resolveChannelOutboundAmbiguity,
  type ChannelOutboundRecord,
  type ChannelOutboundRequest,
  type DurableChannelOutbox,
} from "./index.js";

const requestId = createCanonicalId("request");
const accountId = createCanonicalId("channel-account");
const acceptedAt = toInstant("2026-10-05T20:00:10.000Z");

function request(
  overrides: Partial<ChannelOutboundRequest> = {},
): ChannelOutboundRequest {
  return {
    schemaVersion: 1,
    requestId,
    channel: "telegram",
    accountId,
    conversation: {
      system: "telegram",
      namespace: "9001",
      value: "123",
      conversationKind: "direct",
    },
    replyToMessageId: null,
    content: {
      kind: "options",
      prompt: "Choose all that apply.",
      options: [
        { label: "2/4", selectionId: "opaque_2_4" },
        { label: "3/6", selectionId: "opaque_3_6" },
      ],
    },
    ...overrides,
  };
}

class MemoryOutbox implements DurableChannelOutbox {
  record: ChannelOutboundRecord | null = null;

  async admit(input: {
    readonly request: ChannelOutboundRequest;
    readonly payloadHash: string;
  }): Promise<ChannelOutboundRecord> {
    if (this.record !== null) {
      if (this.record.payloadHash !== input.payloadHash) {
        throw new TypeError("payload conflict");
      }
      return this.record;
    }
    this.record = {
      request: input.request,
      payloadHash: input.payloadHash,
      state: "pending",
      revision: 0,
      providerMessageId: null,
      providerAcceptedAt: null,
      safeFailureCode: null,
      reconciliationEvidenceRef: null,
    };
    return this.record;
  }

  async claimDispatch(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
  }): Promise<ChannelOutboundRecord> {
    const current = this.record!;
    if (
      current.request.requestId !== input.requestId ||
      current.payloadHash !== input.payloadHash ||
      current.state !== "pending" ||
      current.revision !== input.expectedRevision
    ) {
      throw new TypeError("claim conflict");
    }
    return this.record = {
      ...current,
      state: "dispatching",
      revision: current.revision + 1,
    };
  }

  async markSent(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
    readonly providerMessageId: string;
    readonly acceptedAt: Instant;
  }): Promise<ChannelOutboundRecord> {
    const current = this.record!;
    if (
      current.state !== "dispatching" ||
      current.revision !== input.expectedRevision
    ) {
      throw new TypeError("sent conflict");
    }
    return this.record = {
      ...current,
      state: "sent",
      revision: current.revision + 1,
      providerMessageId: input.providerMessageId,
      providerAcceptedAt: input.acceptedAt,
    };
  }

  async markFailed(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
    readonly safeCode: string;
  }): Promise<ChannelOutboundRecord> {
    const current = this.record!;
    if (
      current.state !== "dispatching" ||
      current.revision !== input.expectedRevision
    ) {
      throw new TypeError("failed conflict");
    }
    return this.record = {
      ...current,
      state: "failed",
      revision: current.revision + 1,
      safeFailureCode: input.safeCode,
    };
  }

  async markUnknown(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
  }): Promise<ChannelOutboundRecord> {
    const current = this.record!;
    if (
      current.state !== "dispatching" ||
      current.revision !== input.expectedRevision
    ) {
      throw new TypeError("unknown conflict");
    }
    return this.record = {
      ...current,
      state: "unknown",
      revision: current.revision + 1,
    };
  }

  async resolveAmbiguous(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
    readonly resolution: "sent" | "not-sent";
    readonly evidenceRef: string;
    readonly providerMessageId: string | null;
    readonly acceptedAt: Instant | null;
  }): Promise<ChannelOutboundRecord> {
    const current = this.record!;
    if (
      !["unknown", "dispatching"].includes(current.state) ||
      current.revision !== input.expectedRevision
    ) {
      throw new TypeError("reconcile conflict");
    }
    return this.record = {
      ...current,
      state: input.resolution === "sent" ? "sent" : "failed",
      revision: current.revision + 1,
      providerMessageId: input.providerMessageId,
      providerAcceptedAt: input.acceptedAt,
      safeFailureCode:
        input.resolution === "not-sent"
          ? "reconciled_not_sent"
          : current.safeFailureCode,
      reconciliationEvidenceRef: input.evidenceRef,
    };
  }
}

describe("durable channel outbound dispatch", () => {
  it("persists and claims dispatch before provider send, then stores provider receipt", async () => {
    const outbox = new MemoryOutbox();
    const send = vi.fn(async () => ({
      status: "accepted" as const,
      providerMessageId: "provider-message-1",
      acceptedAt,
    }));
    const dispatcher = createChannelOutboundDispatcher({
      outbox,
      sender: { send },
    });

    await expect(dispatcher.send(request())).resolves.toEqual({
      requestId,
      state: "sent",
      providerMessageId: "provider-message-1",
      acceptedAt,
      replay: false,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox.record).toMatchObject({
      state: "sent",
      revision: 2,
      providerMessageId: "provider-message-1",
    });

    await expect(dispatcher.send(request())).resolves.toMatchObject({
      state: "sent",
      replay: true,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("marks a thrown provider outcome unknown and blocks blind resend", async () => {
    const outbox = new MemoryOutbox();
    const send = vi.fn(async () => {
      throw new Error("socket reset after request body");
    });
    const dispatcher = createChannelOutboundDispatcher({
      outbox,
      sender: { send },
    });

    await expect(dispatcher.send(request())).rejects.toMatchObject({
      code: "channels.outbound_ambiguous",
      retryable: false,
    });
    expect(outbox.record).toMatchObject({ state: "unknown" });
    expect(send).toHaveBeenCalledTimes(1);

    await expect(dispatcher.send(request())).rejects.toMatchObject({
      code: "channels.outbound_reconciliation_required",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("records explicit provider rejection and never silently retries it", async () => {
    const outbox = new MemoryOutbox();
    const send = vi.fn(async () => ({
      status: "rejected" as const,
      safeCode: "recipient_unavailable",
    }));
    const dispatcher = createChannelOutboundDispatcher({
      outbox,
      sender: { send },
    });

    await expect(dispatcher.send(request())).rejects.toMatchObject({
      code: "channels.outbound_failed",
    });
    expect(outbox.record).toMatchObject({
      state: "failed",
      safeFailureCode: "recipient_unavailable",
    });

    await expect(dispatcher.send(request())).rejects.toMatchObject({
      code: "channels.outbound_failed",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reconciles ambiguous sent evidence without provider redispatch", async () => {
    const outbox = new MemoryOutbox();
    const dispatcher = createChannelOutboundDispatcher({
      outbox,
      sender: {
        async send() {
          throw new Error("timeout");
        },
      },
    });
    await expect(dispatcher.send(request())).rejects.toBeDefined();
    const unknown = outbox.record!;

    const resolved = await resolveChannelOutboundAmbiguity({
      outbox,
      record: unknown,
      resolution: "sent",
      evidenceRef: "provider-webhook:message-1",
      providerMessageId: "provider-message-1",
      acceptedAt,
    });
    expect(resolved).toMatchObject({
      state: "sent",
      providerMessageId: "provider-message-1",
      reconciliationEvidenceRef: "provider-webhook:message-1",
    });

    const replaySender = vi.fn();
    const replayDispatcher = createChannelOutboundDispatcher({
      outbox,
      sender: { send: replaySender as never },
    });
    await expect(replayDispatcher.send(request())).resolves.toMatchObject({
      state: "sent",
      replay: true,
    });
    expect(replaySender).not.toHaveBeenCalled();
  });

  it("reconciles proven not-sent evidence to terminal failed without resend", async () => {
    const outbox = new MemoryOutbox();
    const normalized = normalizeChannelOutboundRequest(request());
    const payloadHash = fingerprintChannelOutboundRequest(normalized);
    await outbox.admit({ request: normalized, payloadHash });
    await outbox.claimDispatch({
      requestId,
      payloadHash,
      expectedRevision: 0,
    });
    const dispatching = outbox.record!;

    const resolved = await resolveChannelOutboundAmbiguity({
      outbox,
      record: dispatching,
      resolution: "not-sent",
      evidenceRef: "operator-reconcile:no-provider-receipt",
    });
    expect(resolved).toMatchObject({
      state: "failed",
      safeFailureCode: "reconciled_not_sent",
    });
  });

  it("bounds provider-safe options and rejects oversized UTF-8 callback IDs", () => {
    expect(() =>
      normalizeChannelOutboundRequest(
        request({
          content: {
            kind: "options",
            prompt: "Choose",
            options: [
              {
                label: "Option",
                selectionId: "🙂".repeat(17),
              },
            ],
          },
        }),
      ),
    ).toThrow(/64 bytes/);

    expect(() =>
      normalizeChannelOutboundRequest(
        request({
          content: {
            kind: "options",
            prompt: "Choose",
            options: Array.from({ length: 11 }, (_, index) => ({
              label: `Option ${index}`,
              selectionId: `selection_${index}`,
            })),
          },
        }),
      ),
    ).toThrow(/options are invalid/);
  });

  it("fingerprints exact request payload for durable RequestId replay checks", () => {
    const one = fingerprintChannelOutboundRequest(request());
    const two = fingerprintChannelOutboundRequest(request());
    const changed = fingerprintChannelOutboundRequest(
      request({
        content: {
          kind: "text",
          text: "Changed",
        },
      }),
    );
    expect(one).toBe(two);
    expect(changed).not.toBe(one);
  });
});
