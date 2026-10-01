import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { transitionOperation } from "./operations.js";

function makeOperationRow(state: "authorized") {
  return {
    operation_id: createCanonicalId("operation"),
    tenant_id: createCanonicalId("tenant"),
    kind: "message.send",
    idempotency_key: "idem-1",
    authority_scope_hash: "scope-hash",
    request_fingerprint: "request-hash",
    state,
    created_at: new Date("2026-10-01T00:00:00.000Z"),
    updated_at: new Date("2026-10-01T00:00:01.000Z"),
  };
}

describe("transitionOperation", () => {
  it("rejects an invalid canonical transition before issuing SQL", async () => {
    const query = vi.fn();
    const client = { query } as unknown as PoolClient;
    const operationId = createCanonicalId("operation");

    await expect(
      transitionOperation(client, {
        operationId,
        from: "prepared",
        to: "accepted",
      }),
    ).rejects.toMatchObject({
      code: "operation.invalid_transition",
      category: "conflict",
    });

    expect(query).not.toHaveBeenCalled();
  });

  it("persists a valid transition and returns the canonical record", async () => {
    const row = makeOperationRow("authorized");
    const query = vi.fn(async () => ({
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [row],
    }));
    const client = { query } as unknown as PoolClient;

    const result = await transitionOperation(client, {
      operationId: row.operation_id,
      from: "prepared",
      to: "authorized",
    });

    expect(query).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      operationId: row.operation_id,
      tenantId: row.tenant_id,
      state: "authorized",
    });
  });
});
