import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type OperationId,
} from "@masanawa/contracts";
import {
  assertOperationTransition,
  type ExternalReceiptRecord,
  type OperationRecord,
  type OperationState,
} from "@masanawa/events";
import {
  createProviderRegistry,
  type ProviderExecutionObservation,
} from "@masanawa/providers";
import {
  createAuthorityContext,
} from "@masanawa/security";
import { describe, expect, it } from "vitest";
import { createToolRegistry } from "./registry.js";
import {
  executeConsequentialTool,
  type ToolOperationPrepareInput,
  type ToolOperationStore,
} from "./executor.js";

function memoryOperationStore(): ToolOperationStore {
  const operations = new Map<OperationId, OperationRecord>();
  const idempotency = new Map<string, OperationId>();
  const receipts = new Map<OperationId, ExternalReceiptRecord[]>();

  return {
    async prepare(input: ToolOperationPrepareInput) {
      const key = [
        input.tenantId,
        input.kind,
        input.idempotencyKey,
        input.authorityScopeHash,
      ].join("|");
      const existingId = idempotency.get(key);
      if (existingId) {
        const existing = operations.get(existingId)!;
        if (existing.requestFingerprint !== input.requestFingerprint) {
          throw new Error("fingerprint conflict");
        }
        return { operation: existing, reused: true };
      }
      const now = toInstant("2026-10-02T10:00:00Z");
      const operation: OperationRecord = {
        operationId: createCanonicalId("operation"),
        tenantId: input.tenantId,
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        authorityScopeHash: input.authorityScopeHash,
        requestFingerprint: input.requestFingerprint,
        state: "prepared",
        createdAt: now,
        updatedAt: now,
      };
      operations.set(operation.operationId, operation);
      idempotency.set(key, operation.operationId);
      return { operation, reused: false };
    },
    async load(tenantId, operationId) {
      const operation = operations.get(operationId) ?? null;
      return operation?.tenantId === tenantId ? operation : null;
    },
    async transition(tenantId, operationId, from, to) {
      const prior = operations.get(operationId);
      if (!prior || prior.tenantId !== tenantId || prior.state !== from) {
        throw new Error("stale transition");
      }
      assertOperationTransition(from, to);
      const next = {
        ...prior,
        state: to,
        updatedAt: toInstant("2026-10-02T10:00:01Z"),
      } satisfies OperationRecord;
      operations.set(operationId, next);
      return next;
    },
    async beginReconciliation(input) {
      const prior = operations.get(input.operationId)!;
      if (prior.state === "unknown" || prior.state === "partial") {
        const next = {
          ...prior,
          state: "reconciling" as OperationState,
          updatedAt: toInstant("2026-10-02T10:00:02Z"),
        };
        operations.set(input.operationId, next);
      }
    },
    async recordReceipt(input) {
      const record: ExternalReceiptRecord = {
        externalReceiptId: createCanonicalId("external-receipt"),
        tenantId: input.tenantId,
        operationId: input.operationId,
        ...input.evidence,
        createdAt: toInstant("2026-10-02T10:00:03Z"),
      };
      const existing = receipts.get(input.operationId) ?? [];
      existing.push(record);
      receipts.set(input.operationId, existing);
      return record;
    },
    async listReceipts(tenantId, operationId) {
      const operation = operations.get(operationId);
      if (!operation || operation.tenantId !== tenantId) {
        return Object.freeze([]);
      }
      return Object.freeze([...(receipts.get(operationId) ?? [])]);
    },
  };
}

function dispatchReceipt(normalizedStatus = "succeeded") {
  return {
    observationKey: `provider-observation-${normalizedStatus}`,
    providerReference: "provider-charge-1",
    normalizedStatus,
    payloadHash: "sha256:receipt",
    payloadRef: null,
    observedAt: toInstant("2026-10-02T10:00:03Z"),
    verificationMethod: "provider-response",
  } as const;
}

function fixture() {
  const capability = normalizeCapabilityKey("payments.charge");
  const tools = createToolRegistry();
  tools.registerCapability({
    key: capability,
    description: "Charge a payment provider.",
  });
  const toolVersionId = createCanonicalId("tool-version");
  tools.registerTool({
    toolId: createCanonicalId("tool"),
    toolVersionId,
    key: "charge",
    version: "v1",
    displayName: "Charge",
    description: "Create one external charge.",
    capabilities: [capability],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    requiredAuthorityCapabilities: [capability],
    riskClass: "consequential",
    sideEffectClass: "external-consequential",
    sensitivity: "sensitive",
    timeoutMs: 30_000,
    rateLimit: null,
    costClass: "external",
    idempotencyMode: "operation-bound",
    reconciliationMode: "on-unknown",
    providerRequirement: { capability },
  });

  const providers = createProviderRegistry();
  const providerId = createCanonicalId("provider");
  providers.register({
    providerId,
    key: "payments",
    version: "v1",
    displayName: "Payments",
    capabilities: [capability],
    selectionPriority: 1,
    credentialSlots: [
      {
        key: "api-key",
        required: true,
        description: "Provider API credential.",
      },
    ],
  });
  providers.setReadiness({
    providerId,
    state: "ready",
    reasonCode: null,
    checkedAt: toInstant("2026-10-02T10:00:00Z"),
  });

  const tenantId = createCanonicalId("tenant");
  const authority = createAuthorityContext({
    tenantId,
    principal: {
      kind: "system",
      systemKind: "tool-executor-test",
    },
    scopes: [],
    capabilities: [capability],
    resourceScope: {},
    policyRevision: "policy-1",
    approvalIds: [],
    delegationChain: [],
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
  });

  return {
    capability,
    tools,
    providers,
    toolVersionId,
    tenantId,
    authority,
  };
}

describe("consequential Tool executor", () => {
  it("dispatches once and exact replay never duplicates the side effect", async () => {
    const f = fixture();
    const operations = memoryOperationStore();
    let dispatches = 0;

    const dependencies = {
      tools: f.tools,
      providers: f.providers,
      authoritySource: {
        getPolicyRevision: () => "policy-1",
      },
      operations,
      resolveAdapter: () => ({
        async dispatch() {
          dispatches += 1;
          return {
            status: "succeeded" as const,
            output: { chargeId: "charge_1" },
            receipt: dispatchReceipt(),
          };
        },
      }),
    };

    const invocation = {
      toolVersionId: f.toolVersionId,
      authority: f.authority,
      input: { amount: 1000 },
      idempotencyKey: "charge-request-1",
      providerSelection: null,
    } as const;
    const credentialBindings = {
      "api-key": createCanonicalId("credential-ref"),
    };

    const first = await executeConsequentialTool(dependencies, {
      invocation,
      credentialBindings,
      idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
    });
    const replay = await executeConsequentialTool(dependencies, {
      invocation,
      credentialBindings,
      idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
    });

    expect(first.operation.state).toBe("succeeded");
    expect(replay.operation.state).toBe("succeeded");
    expect(replay.reused).toBe(true);
    expect(replay.dispatched).toBe(false);
    expect(first.receipts).toHaveLength(1);
    expect(replay.receipts).toEqual(first.receipts);
    expect(replay.receipts[0]).toMatchObject({
      provider: "payments",
      normalizedStatus: "succeeded",
      providerReference: "provider-charge-1",
    });
    expect(dispatches).toBe(1);
  });

  it("revalidates current authority before dispatch", async () => {
    const f = fixture();
    const operations = memoryOperationStore();
    let dispatches = 0;

    await expect(
      executeConsequentialTool(
        {
          tools: f.tools,
          providers: f.providers,
          authoritySource: {
            getPolicyRevision: () => "policy-2",
          },
          operations,
          resolveAdapter: () => ({
            async dispatch() {
              dispatches += 1;
              return {
                status: "succeeded" as const,
                output: {},
                receipt: dispatchReceipt(),
              };
            },
          }),
        },
        {
          invocation: {
            toolVersionId: f.toolVersionId,
            authority: f.authority,
            input: { amount: 1000 },
            idempotencyKey: "charge-request-stale",
            providerSelection: null,
          },
          credentialBindings: {
            "api-key": createCanonicalId("credential-ref"),
          },
          idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
        },
      ),
    ).rejects.toMatchObject({
      code: "authority.stale_policy",
    });
    expect(dispatches).toBe(0);
  });

  it("turns dispatch ambiguity into reconciliation and never blind-retries", async () => {
    const f = fixture();
    const operations = memoryOperationStore();
    let dispatches = 0;

    const result = await executeConsequentialTool(
      {
        tools: f.tools,
        providers: f.providers,
        authoritySource: {
          getPolicyRevision: () => "policy-1",
        },
        operations,
        resolveAdapter: () => ({
          async dispatch() {
            dispatches += 1;
            throw new Error("connection reset after provider accepted request");
          },
        }),
      },
      {
        invocation: {
          toolVersionId: f.toolVersionId,
          authority: f.authority,
          input: { amount: 1000 },
          idempotencyKey: "charge-request-unknown",
          providerSelection: null,
        },
        credentialBindings: {
          "api-key": createCanonicalId("credential-ref"),
        },
        idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
      },
    );

    expect(result.operation.state).toBe("reconciling");
    expect(dispatches).toBe(1);
  });

  it("reconciles replay after a crash between receipt persistence and dispatch settlement", async () => {
    const f = fixture();
    const baseOperations = memoryOperationStore();
    let failSettlementOnce = true;
    const operations: ToolOperationStore = {
      ...baseOperations,
      async transition(tenantId, operationId, from, to) {
        if (
          failSettlementOnce &&
          from === "dispatching" &&
          to === "dispatched"
        ) {
          failSettlementOnce = false;
          throw new Error("simulated crash after durable receipt");
        }
        return baseOperations.transition(tenantId, operationId, from, to);
      },
    };
    let dispatches = 0;

    const dependencies = {
      tools: f.tools,
      providers: f.providers,
      authoritySource: {
        getPolicyRevision: () => "policy-1",
      },
      operations,
      resolveAdapter: () => ({
        async dispatch() {
          dispatches += 1;
          return {
            status: "succeeded" as const,
            output: { chargeId: "charge_crash" },
            receipt: dispatchReceipt(),
          };
        },
      }),
    };

    const invocation = {
      toolVersionId: f.toolVersionId,
      authority: f.authority,
      input: { amount: 1000 },
      idempotencyKey: "charge-request-crash-after-receipt",
      providerSelection: null,
    } as const;
    const executionInput = {
      invocation,
      credentialBindings: {
        "api-key": createCanonicalId("credential-ref"),
      },
      idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
    };

    await expect(
      executeConsequentialTool(dependencies, executionInput),
    ).rejects.toThrow(/simulated crash/u);

    const replay = await executeConsequentialTool(
      dependencies,
      executionInput,
    );

    expect(replay.operation.state).toBe("reconciling");
    expect(replay.reused).toBe(true);
    expect(replay.dispatched).toBe(false);
    expect(replay.receipts).toHaveLength(1);
    expect(dispatches).toBe(1);
  });

  it("emits typed provider observations without exposing credential material", async () => {
    const f = fixture();
    const operations = memoryOperationStore();
    const observations: ProviderExecutionObservation[] = [];
    let clock = 1_000;

    const result = await executeConsequentialTool(
      {
        tools: f.tools,
        providers: f.providers,
        authoritySource: {
          getPolicyRevision: () => "policy-1",
        },
        operations,
        nowMs: () => {
          const value = clock;
          clock += 25;
          return value;
        },
        providerObserver: {
          observe(observation) {
            observations.push(observation);
          },
        },
        resolveAdapter: () => ({
          async dispatch() {
            return {
              status: "not-dispatched" as const,
              errorCode: "provider-timeout",
              failure: {
                kind: "timeout" as const,
                code: "request.timeout",
                retryable: true,
                dispatched: false,
                safeMessage: "Provider request timed out before dispatch.",
                retryAfterMs: 1_000,
              },
            };
          },
        }),
      },
      {
        invocation: {
          toolVersionId: f.toolVersionId,
          authority: f.authority,
          input: { amount: 1000 },
          idempotencyKey: "charge-request-observation",
          providerSelection: null,
        },
        credentialBindings: {
          "api-key": createCanonicalId("credential-ref"),
        },
        idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
      },
    );

    expect(result.operation.state).toBe("failed");
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      providerKey: "payments",
      providerVersion: "v1",
      capability: f.capability,
      outcome: "not-dispatched",
      durationMs: 25,
      failure: {
        kind: "timeout",
        code: "request.timeout",
        dispatched: false,
      },
    });
    expect(JSON.stringify(observations)).not.toContain("credential-ref");
    expect(JSON.stringify(observations)).not.toContain("api-key");
  });

  it("moves receipt persistence failure to reconciliation instead of success", async () => {
    const f = fixture();
    const baseOperations = memoryOperationStore();
    const operations: ToolOperationStore = {
      ...baseOperations,
      async recordReceipt() {
        throw new Error("receipt store unavailable");
      },
    };
    let dispatches = 0;

    const result = await executeConsequentialTool(
      {
        tools: f.tools,
        providers: f.providers,
        authoritySource: {
          getPolicyRevision: () => "policy-1",
        },
        operations,
        resolveAdapter: () => ({
          async dispatch() {
            dispatches += 1;
            return {
              status: "succeeded" as const,
              output: { chargeId: "charge_receipt_failure" },
              receipt: dispatchReceipt(),
            };
          },
        }),
      },
      {
        invocation: {
          toolVersionId: f.toolVersionId,
          authority: f.authority,
          input: { amount: 1000 },
          idempotencyKey: "charge-request-receipt-failure",
          providerSelection: null,
        },
        credentialBindings: {
          "api-key": createCanonicalId("credential-ref"),
        },
        idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
      },
    );

    expect(result.operation.state).toBe("reconciling");
    expect(result.receipts).toEqual([]);
    expect(dispatches).toBe(1);
  });

  it("rejects missing or non-canonical credential bindings before dispatch", async () => {
    const f = fixture();
    const operations = memoryOperationStore();

    await expect(
      executeConsequentialTool(
        {
          tools: f.tools,
          providers: f.providers,
          authoritySource: {
            getPolicyRevision: () => "policy-1",
          },
          operations,
          resolveAdapter: () => ({
            async dispatch() {
              return {
                status: "succeeded" as const,
                output: {},
                receipt: dispatchReceipt(),
              };
            },
          }),
        },
        {
          invocation: {
            toolVersionId: f.toolVersionId,
            authority: f.authority,
            input: { amount: 1000 },
            idempotencyKey: "charge-request-no-credential",
            providerSelection: null,
          },
          credentialBindings: {},
          idempotencyExpiresAt: toInstant("2026-10-03T10:00:00Z"),
        },
      ),
    ).rejects.toThrow(/required provider credential slot/u);
  });
});
