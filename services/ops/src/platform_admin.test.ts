import { describe, expect, it } from "vitest";
import type { TenantId } from "@masanawa/contracts";
import type { AgentAdminAuthorizer } from "./agent_admin.js";
import {
  createPlatformAdminService,
  type PlatformAdminQuery,
} from "./platform_admin.js";

const tenantId =
  "tenant_00000000-0000-4000-8000-000000000001" as TenantId;

function authorizer(seen: string[]): AgentAdminAuthorizer {
  return {
    async authorize(input) {
      seen.push(input.capability);
      if (input.authorizationHeader !== "Bearer operator") {
        throw new Error("denied");
      }
      return { tenantId };
    },
  };
}

describe("platform admin projections", () => {
  it("authorizes and scopes user reads to the operator tenant", async () => {
    const seen: string[] = [];
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const database = {
      async query(text: string, values?: unknown[]) {
        queries.push({ text, values });
        return {
          rows: [
            {
              user_id: "user_00000000-0000-4000-8000-000000000002",
              state: "active",
              revision: "3",
              created_at: new Date("2026-10-01T00:00:00Z"),
              updated_at: new Date("2026-10-02T00:00:00Z"),
              identity_count: "2",
              relationship_count: "4",
            },
          ],
        };
      },
    } as unknown as PlatformAdminQuery;
    const service = createPlatformAdminService({
      database,
      authorizer: authorizer(seen),
    });

    const users = await service.listUsers({
      authorizationHeader: "Bearer operator",
      state: "active",
      limit: 25,
    });

    expect(seen).toEqual(["identity.users.read"]);
    expect(queries[0]?.text).toContain("AND u.state = $3");
    expect(queries[0]?.values).toEqual([tenantId, 25, "active"]);
    expect(users[0]).toMatchObject({
      state: "active",
      revision: 3,
      identityCount: 2,
      relationshipCount: 4,
    });
  });

  it("does not expose a direct-SQL user lifecycle mutation", () => {
    const service = createPlatformAdminService({
      database: { async query() { return { rows: [] }; } } as unknown as PlatformAdminQuery,
      authorizer: authorizer([]),
    });

    expect("setUserState" in service).toBe(false);
  });

  it("tenant-scopes canonical Offer revisions and preserves preconditions", async () => {
    const seen: string[] = [];
    const calls: unknown[] = [];
    const service = createPlatformAdminService({
      database: { async query() { return { rows: [] }; } } as unknown as PlatformAdminQuery,
      authorizer: authorizer(seen),
      offerCommands: {
        async setEnabled() {
          throw new Error("not used");
        },
        async saveRevision(input) {
          calls.push(input);
          return {
            offerId: "offer_00000000-0000-4000-8000-000000000010",
            key: input.key,
            revision: 1,
            title: input.title,
            description: input.description,
            skillVersionId: input.skillVersionId,
            priceCredits: input.priceCredits,
            fulfillmentReserveCredits: input.fulfillmentReserveCredits,
            creatorCommissionCredits: input.creatorCommissionCredits,
            fallbackCommissionCredits: input.fallbackCommissionCredits,
            platformMarginCredits: input.platformMarginCredits,
            regions: input.regions,
            enabled: input.enabled,
            updatedAt: "2026-10-05T00:00:00.000Z",
          };
        },
      },
    });

    await service.saveOfferRevision({
      authorizationHeader: "Bearer operator",
      offerId: null,
      expectedRevision: null,
      key: "airtime.ng",
      title: "Airtime",
      description: "Buy airtime",
      skillVersionId:
        "skill-version_00000000-0000-4000-8000-000000000011",
      priceCredits: 100,
      fulfillmentReserveCredits: 70,
      creatorCommissionCredits: 20,
      fallbackCommissionCredits: 10,
      platformMarginCredits: 10,
      regions: ["NG"],
      enabled: true,
    });

    expect(seen).toEqual(["commerce.write"]);
    expect(calls).toEqual([{
      tenantId,
      offerId: null,
      expectedRevision: null,
      key: "airtime.ng",
      title: "Airtime",
      description: "Buy airtime",
      skillVersionId:
        "skill-version_00000000-0000-4000-8000-000000000011",
      priceCredits: 100,
      fulfillmentReserveCredits: 70,
      creatorCommissionCredits: 20,
      fallbackCommissionCredits: 10,
      platformMarginCredits: 10,
      regions: ["NG"],
      enabled: true,
    }]);
  });

  it("tenant-scopes canonical external receipt drill-downs", async () => {
    const seen: string[] = [];
    const receiptCalls: Array<{ tenantId: TenantId; operationId: string }> = [];
    const service = createPlatformAdminService({
      database: { async query() { return { rows: [] }; } } as unknown as PlatformAdminQuery,
      authorizer: authorizer(seen),
      receiptReader: {
        async list(input) {
          receiptCalls.push(input);
          return [];
        },
      },
    });

    await service.listOperationReceipts({
      authorizationHeader: "Bearer operator",
      operationId: "operation_00000000-0000-4000-8000-000000000009",
    });

    expect(seen).toEqual(["operations.read"]);
    expect(receiptCalls).toEqual([{
      tenantId,
      operationId: "operation_00000000-0000-4000-8000-000000000009",
    }]);
  });

  it("never selects encrypted credential material for the mobile admin", async () => {
    const seen: string[] = [];
    let queryText = "";
    const database = {
      async query(text: string) {
        queryText = text;
        return {
          rows: [
            {
              credential_ref_id:
                "credential-ref_00000000-0000-4000-8000-000000000002",
              provider_id:
                "provider_00000000-0000-4000-8000-000000000003",
              slot_key: "primary",
              generation: 2,
              algorithm: "aes-gcm",
              key_id: "key-2",
              active: true,
              created_at: new Date("2026-10-01T00:00:00Z"),
              updated_at: new Date("2026-10-03T00:00:00Z"),
            },
          ],
        };
      },
    } as unknown as PlatformAdminQuery;
    const service = createPlatformAdminService({
      database,
      authorizer: authorizer(seen),
    });

    const credentials = await service.listCredentialRefs({
      authorizationHeader: "Bearer operator",
    });

    expect(seen).toEqual(["providers.credentials.read"]);
    expect(queryText.toLowerCase()).not.toContain("ciphertext");
    expect(queryText.toLowerCase()).not.toContain("nonce");
    expect(credentials[0]).not.toHaveProperty("ciphertext");
    expect(credentials[0]).not.toHaveProperty("nonce");
  });

  it("does not touch storage when authorization fails", async () => {
    let calls = 0;
    const database = {
      async query() {
        calls += 1;
        return { rows: [] };
      },
    } as unknown as PlatformAdminQuery;
    const service = createPlatformAdminService({
      database,
      authorizer: {
        async authorize() {
          throw new Error("denied");
        },
      },
    });

    await expect(
      service.listOperations({ authorizationHeader: "Bearer wrong" }),
    ).rejects.toThrow("denied");
    expect(calls).toBe(0);
  });
});
