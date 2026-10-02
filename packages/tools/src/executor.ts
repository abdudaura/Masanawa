import {
  PlatformError,
  type Instant,
  type OperationId,
} from "@masanawa/contracts";
import {
  type ExternalReceiptEvidence,
  type ExternalReceiptRecord,
  type OperationRecord,
  type OperationState,
} from "@masanawa/events";
import {
  normalizeProviderCredentialBindings,
  type ProviderCredentialBindings,
  type ProviderRegistry,
  type ProviderSelection,
} from "@masanawa/providers";
import {
  assertCurrentAuthority,
  fingerprintCanonicalJson,
  principalKey,
  type CanonicalJson,
  type CurrentAuthoritySource,
} from "@masanawa/security";
import {
  normalizeToolInvocation,
  type NormalizedToolInvocation,
  type ToolInvocation,
} from "./execution.js";
import {
  selectProviderForTool,
  type ToolRegistry,
} from "./registry.js";
import type { ToolDefinition } from "./model.js";

export interface ToolOperationPrepareInput {
  readonly tenantId: NormalizedToolInvocation["authority"]["tenantId"];
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly authorityScopeHash: string;
  readonly requestFingerprint: string;
  readonly expiresAt: Instant;
}

export interface ToolOperationStore {
  prepare(input: ToolOperationPrepareInput): Promise<{
    readonly operation: OperationRecord;
    readonly reused: boolean;
  }>;
  load(
    tenantId: NormalizedToolInvocation["authority"]["tenantId"],
    operationId: OperationId,
  ): Promise<OperationRecord | null>;
  transition(
    tenantId: NormalizedToolInvocation["authority"]["tenantId"],
    operationId: OperationId,
    from: OperationState,
    to: OperationState,
  ): Promise<OperationRecord>;
  beginReconciliation(input: {
    readonly tenantId: NormalizedToolInvocation["authority"]["tenantId"];
    readonly operationId: OperationId;
    readonly reasonCode: string;
    readonly safeRetry: boolean;
    readonly nextAction: string | null;
  }): Promise<void>;
  recordReceipt(input: {
    readonly tenantId: NormalizedToolInvocation["authority"]["tenantId"];
    readonly operationId: OperationId;
    readonly evidence: ExternalReceiptEvidence;
  }): Promise<ExternalReceiptRecord>;
  listReceipts(
    tenantId: NormalizedToolInvocation["authority"]["tenantId"],
    operationId: OperationId,
  ): Promise<readonly ExternalReceiptRecord[]>;
}

export interface ToolDispatchContext {
  readonly operation: OperationRecord;
  readonly tool: ToolDefinition;
  readonly invocation: NormalizedToolInvocation;
  readonly provider: ProviderSelection | null;
  readonly credentialBindings: ProviderCredentialBindings;
}

export interface ToolDispatchReceipt {
  readonly observationKey: string;
  readonly providerReference: string | null;
  readonly normalizedStatus: string;
  readonly payloadHash: string | null;
  readonly payloadRef: string | null;
  readonly observedAt: Instant;
  readonly verificationMethod: string;
}

export type ToolDispatchOutcome =
  | {
      readonly status: "succeeded";
      readonly output: CanonicalJson;
      readonly receipt: ToolDispatchReceipt;
    }
  | {
      readonly status: "accepted";
      readonly output?: CanonicalJson;
      readonly receipt: ToolDispatchReceipt;
    }
  | {
      readonly status: "rejected";
      readonly errorCode: string;
      readonly receipt: ToolDispatchReceipt;
    }
  | {
      readonly status: "partial";
      readonly reasonCode: string;
      readonly output?: CanonicalJson;
      readonly receipt: ToolDispatchReceipt;
    }
  | {
      readonly status: "unknown";
      readonly reasonCode: string;
      readonly receipt?: ToolDispatchReceipt;
    }
  | {
      readonly status: "not-dispatched";
      readonly errorCode: string;
    };

export interface ToolDispatchAdapter {
  dispatch(context: ToolDispatchContext): Promise<ToolDispatchOutcome>;
}

export interface ConsequentialToolExecutionDependencies {
  readonly tools: ToolRegistry;
  readonly providers: ProviderRegistry;
  readonly authoritySource: CurrentAuthoritySource;
  readonly operations: ToolOperationStore;
  readonly resolveAdapter: (
    tool: ToolDefinition,
    provider: ProviderSelection | null,
  ) => ToolDispatchAdapter;
}

export interface ConsequentialToolExecutionInput {
  readonly invocation: ToolInvocation;
  readonly credentialBindings: Readonly<
    Record<string, import("@masanawa/contracts").CredentialRefId>
  >;
  readonly idempotencyExpiresAt: Instant;
}

export interface ConsequentialToolExecutionResult {
  readonly operation: OperationRecord;
  readonly reused: boolean;
  readonly dispatched: boolean;
  readonly receipts: readonly ExternalReceiptRecord[];
  readonly output?: CanonicalJson;
}

function executionError(
  code: string,
  category: "validation" | "authorization" | "conflict" | "not-found",
  message: string,
  operationId?: OperationId,
): PlatformError {
  return new PlatformError({
    code,
    category,
    message,
    retryable: false,
    ...(operationId ? { operationId } : {}),
  });
}

function assertConsequentialTool(tool: ToolDefinition): void {
  const consequential =
    tool.riskClass === "consequential" ||
    tool.riskClass === "restricted" ||
    tool.sideEffectClass === "external-consequential";
  if (!consequential) {
    throw executionError(
      "tool.execution_not_consequential",
      "validation",
      "Consequential execution path only accepts consequential Tool definitions",
    );
  }
}

function assertAuthorityCapabilities(
  tool: ToolDefinition,
  invocation: NormalizedToolInvocation,
): void {
  const granted = new Set(invocation.authority.capabilities);
  const missing = tool.requiredAuthorityCapabilities.filter(
    (capability) => !granted.has(capability),
  );
  if (missing.length > 0) {
    throw executionError(
      "tool.authority_capability_missing",
      "authorization",
      `Authority is missing required Tool capability: ${missing.join(", ")}`,
    );
  }
}

function authorityScopeHash(
  invocation: NormalizedToolInvocation,
): string {
  const authority = invocation.authority;
  return fingerprintCanonicalJson({
    tenantId: authority.tenantId,
    principalKey: principalKey(authority.principal),
    scopes: authority.scopes,
    capabilities: authority.capabilities,
    resourceScope: authority.resourceScope,
    policyRevision: authority.policyRevision,
    approvalIds: authority.approvalIds,
    delegationChain: authority.delegationChain,
  });
}

function requestFingerprint(input: {
  readonly tool: ToolDefinition;
  readonly invocation: NormalizedToolInvocation;
  readonly provider: ProviderSelection | null;
  readonly credentials: ProviderCredentialBindings;
}): string {
  return fingerprintCanonicalJson({
    toolVersionId: input.tool.toolVersionId,
    input: input.invocation.input,
    providerId: input.provider?.provider.providerId ?? null,
    providerKey: input.provider?.provider.key ?? null,
    providerVersion: input.provider?.provider.version ?? null,
    credentialBindings: input.credentials,
  });
}

async function transitionIfCurrent(
  operations: ToolOperationStore,
  operation: OperationRecord,
  to: OperationState,
): Promise<OperationRecord> {
  return operations.transition(
    operation.tenantId,
    operation.operationId,
    operation.state,
    to,
  );
}

function toReceiptEvidence(
  tool: ToolDefinition,
  provider: ProviderSelection | null,
  receipt: ToolDispatchReceipt,
): ExternalReceiptEvidence {
  return Object.freeze({
    provider: provider?.provider.key ?? `tool:${tool.key}`,
    observationKey: receipt.observationKey,
    providerReference: receipt.providerReference,
    normalizedStatus: receipt.normalizedStatus,
    payloadHash: receipt.payloadHash,
    payloadRef: receipt.payloadRef,
    observedAt: receipt.observedAt,
    verificationMethod: receipt.verificationMethod,
    providerVersion: provider?.provider.version ?? tool.version,
  });
}

async function reconcileUnknown(
  operations: ToolOperationStore,
  operation: OperationRecord,
  reasonCode: string,
): Promise<OperationRecord> {
  let current = operation;
  if (current.state !== "unknown" && current.state !== "reconciling") {
    current = await transitionIfCurrent(operations, current, "unknown");
  }
  await operations.beginReconciliation({
    tenantId: current.tenantId,
    operationId: current.operationId,
    reasonCode,
    safeRetry: false,
    nextAction: "reconcile-provider-state",
  });
  return (
    (await operations.load(current.tenantId, current.operationId)) ?? current
  );
}

export async function executeConsequentialTool(
  dependencies: ConsequentialToolExecutionDependencies,
  input: ConsequentialToolExecutionInput,
): Promise<ConsequentialToolExecutionResult> {
  const invocation = normalizeToolInvocation(input.invocation);
  const tool = dependencies.tools.getToolVersion(invocation.toolVersionId);
  if (!tool) {
    throw executionError(
      "tool.version_not_found",
      "not-found",
      "Tool version is not registered",
    );
  }

  assertConsequentialTool(tool);
  assertAuthorityCapabilities(tool, invocation);

  if (tool.idempotencyMode !== "operation-bound") {
    throw executionError(
      "tool.operation_idempotency_required",
      "validation",
      "Consequential Tool execution requires operation-bound idempotency",
    );
  }
  if (invocation.idempotencyKey === null) {
    throw executionError(
      "tool.idempotency_key_required",
      "validation",
      "Consequential Tool invocation requires an idempotency key",
    );
  }

  const provider = selectProviderForTool(
    tool,
    dependencies.providers,
    invocation.providerSelection ?? {},
  );
  let credentialBindings: ProviderCredentialBindings;
  if (provider === null) {
    if (Object.keys(input.credentialBindings).length > 0) {
      throw executionError(
        "tool.provider_credentials_not_applicable",
        "validation",
        "Provider-independent Tool invocation cannot carry provider credential bindings",
      );
    }
    credentialBindings = Object.freeze({});
  } else {
    credentialBindings = normalizeProviderCredentialBindings(
      provider.provider,
      input.credentialBindings,
    );
  }

  const prepared = await dependencies.operations.prepare({
    tenantId: invocation.authority.tenantId,
    kind: `tool:${tool.key}@${tool.version}`,
    idempotencyKey: invocation.idempotencyKey,
    authorityScopeHash: authorityScopeHash(invocation),
    requestFingerprint: requestFingerprint({
      tool,
      invocation,
      provider,
      credentials: credentialBindings,
    }),
    expiresAt: input.idempotencyExpiresAt,
  });

  let operation = prepared.operation;

  if (
    prepared.reused &&
    operation.state !== "prepared" &&
    operation.state !== "authorized"
  ) {
    return {
      operation,
      reused: true,
      dispatched: false,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
    };
  }

  try {
    await assertCurrentAuthority(
      invocation.authority,
      dependencies.authoritySource,
    );
    assertAuthorityCapabilities(tool, invocation);
  } catch (error) {
    if (operation.state === "prepared") {
      operation = await transitionIfCurrent(
        dependencies.operations,
        operation,
        "rejected",
      );
    }
    throw error;
  }

  if (operation.state === "prepared") {
    operation = await transitionIfCurrent(
      dependencies.operations,
      operation,
      "authorized",
    );
  }

  if (operation.state !== "authorized") {
    return {
      operation,
      reused: prepared.reused,
      dispatched: false,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
    };
  }

  operation = await transitionIfCurrent(
    dependencies.operations,
    operation,
    "dispatching",
  );

  const adapter = dependencies.resolveAdapter(tool, provider);
  let outcome: ToolDispatchOutcome;
  try {
    outcome = await adapter.dispatch({
      operation,
      tool,
      invocation,
      provider,
      credentialBindings,
    });
  } catch {
    const latest = await reconcileUnknown(
      dependencies.operations,
      operation,
      "tool.dispatch_exception",
    );
    return {
      operation: latest,
      reused: prepared.reused,
      dispatched: true,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
    };
  }

  let receipt: ExternalReceiptRecord | null = null;
  if (outcome.status !== "not-dispatched" && outcome.receipt !== undefined) {
    try {
      receipt = await dependencies.operations.recordReceipt({
        tenantId: invocation.authority.tenantId,
        operationId: operation.operationId,
        evidence: toReceiptEvidence(tool, provider, outcome.receipt),
      });
    } catch {
      const latest = await reconcileUnknown(
        dependencies.operations,
        operation,
        "tool.receipt_persist_failed",
      );
      return {
        operation: latest,
        reused: prepared.reused,
        dispatched: true,
        receipts: await dependencies.operations.listReceipts(
          invocation.authority.tenantId,
          operation.operationId,
        ),
      };
    }
  }

  if (
    outcome.status !== "not-dispatched" &&
    outcome.status !== "unknown" &&
    receipt === null
  ) {
    const latest = await reconcileUnknown(
      dependencies.operations,
      operation,
      "tool.receipt_missing",
    );
    return {
      operation: latest,
      reused: prepared.reused,
      dispatched: true,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
    };
  }

  if (outcome.status === "not-dispatched") {
    operation = await transitionIfCurrent(
      dependencies.operations,
      operation,
      "failed",
    );
    return {
      operation,
      reused: prepared.reused,
      dispatched: false,
      receipts: Object.freeze([]),
    };
  }

  if (outcome.status === "rejected") {
    operation = await transitionIfCurrent(
      dependencies.operations,
      operation,
      "rejected",
    );
    return {
      operation,
      reused: prepared.reused,
      dispatched: true,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
    };
  }

  if (outcome.status === "unknown") {
    const latest = await reconcileUnknown(
      dependencies.operations,
      operation,
      outcome.reasonCode,
    );
    return {
      operation: latest,
      reused: prepared.reused,
      dispatched: true,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
    };
  }

  operation = await transitionIfCurrent(
    dependencies.operations,
    operation,
    "dispatched",
  );

  if (outcome.status === "partial") {
    operation = await transitionIfCurrent(
      dependencies.operations,
      operation,
      "partial",
    );
    await dependencies.operations.beginReconciliation({
      tenantId: invocation.authority.tenantId,
      operationId: operation.operationId,
      reasonCode: outcome.reasonCode,
      safeRetry: false,
      nextAction: "reconcile-provider-state",
    });
    const latest =
      (await dependencies.operations.load(
        invocation.authority.tenantId,
        operation.operationId,
      )) ?? operation;
    return {
      operation: latest,
      reused: prepared.reused,
      dispatched: true,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
      ...(outcome.output !== undefined ? { output: outcome.output } : {}),
    };
  }

  operation = await transitionIfCurrent(
    dependencies.operations,
    operation,
    "accepted",
  );

  if (outcome.status === "accepted") {
    if (tool.reconciliationMode === "always") {
      operation = await transitionIfCurrent(
        dependencies.operations,
        operation,
        "reconciling",
      );
      await dependencies.operations.beginReconciliation({
        tenantId: invocation.authority.tenantId,
        operationId: operation.operationId,
        reasonCode: "tool.accepted_requires_reconciliation",
        safeRetry: false,
        nextAction: "reconcile-provider-state",
      });
    }
    const latest =
      (await dependencies.operations.load(
        invocation.authority.tenantId,
        operation.operationId,
      )) ?? operation;
    return {
      operation: latest,
      reused: prepared.reused,
      dispatched: true,
      receipts: await dependencies.operations.listReceipts(
        invocation.authority.tenantId,
        operation.operationId,
      ),
      ...(outcome.output !== undefined ? { output: outcome.output } : {}),
    };
  }

  operation = await transitionIfCurrent(
    dependencies.operations,
    operation,
    "succeeded",
  );
  return {
    operation,
    reused: prepared.reused,
    dispatched: true,
    receipts: await dependencies.operations.listReceipts(
      invocation.authority.tenantId,
      operation.operationId,
    ),
    output: outcome.output,
  };
}
