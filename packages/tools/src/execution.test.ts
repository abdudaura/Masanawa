import {
  createCanonicalId,
  normalizeCapabilityKey,
} from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { describe, expect, it } from "vitest";
import { normalizeToolInvocation } from "./execution.js";

describe("Tool invocation envelope", () => {
  it("keeps canonical authority outside model input and normalizes idempotency", () => {
    const tenantId = createCanonicalId("tenant");
    const authority = createAuthorityContext({
      tenantId,
      principal: {
        kind: "system",
        systemKind: "tool-invocation-test",
      },
      scopes: [],
      capabilities: [normalizeCapabilityKey("search.web")],
      resourceScope: {},
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const normalized = normalizeToolInvocation({
      toolVersionId: createCanonicalId("tool-version"),
      authority,
      input: {
        query: "current weather",
      },
      idempotencyKey: "  request-42  ",
      providerSelection: null,
    });

    expect(normalized.authority).toBe(authority);
    expect(normalized.idempotencyKey).toBe("request-42");
    expect(normalized.input).toEqual({ query: "current weather" });
    expect(Object.isFrozen(normalized.input)).toBe(true);
  });

  it("rejects non-data input and empty explicit provider selection", () => {
    const tenantId = createCanonicalId("tenant");
    const authority = createAuthorityContext({
      tenantId,
      principal: {
        kind: "system",
        systemKind: "tool-invocation-test",
      },
      scopes: [],
      capabilities: [normalizeCapabilityKey("search.web")],
      resourceScope: {},
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    expect(() =>
      normalizeToolInvocation({
        toolVersionId: createCanonicalId("tool-version"),
        authority,
        input: { invalid: undefined } as never,
        idempotencyKey: null,
        providerSelection: null,
      }),
    ).toThrow(/Undefined is not canonical JSON/u);

    expect(() =>
      normalizeToolInvocation({
        toolVersionId: createCanonicalId("tool-version"),
        authority,
        input: {},
        idempotencyKey: null,
        providerSelection: {},
      }),
    ).toThrow(/must identify an explicit provider/u);
  });
});
