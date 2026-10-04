import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { CredentialSecret, type CredentialMaterialSource } from "@masanawa/security";
import { CredentialResolvedFlutterwaveBillsClient } from "./credential-client.js";
import type { FlutterwaveBillsTransport } from "./client.js";

function scope() {
  return {
    tenantId: createCanonicalId("tenant"),
    credentialRefId: createCanonicalId("credential-ref"),
    providerId: createCanonicalId("provider"),
    operationId: createCanonicalId("operation"),
  };
}

describe("CredentialResolvedFlutterwaveBillsClient", () => {
  it("resolves the scoped secret at the adapter edge for every operation", async () => {
    const requests: unknown[] = [];
    let resolutions = 0;
    const source: CredentialMaterialSource = {
      async resolve() {
        resolutions += 1;
        return CredentialSecret.fromString("live-secret");
      },
    };
    const transport: FlutterwaveBillsTransport = {
      async request(input) {
        requests.push(input);
        return {
          status: 200,
          body: {
            status: "success",
            data: [{ code: "AIRTIME", name: "Airtime", country_code: "NG" }],
          },
        };
      },
    };
    const client = new CredentialResolvedFlutterwaveBillsClient({
      source,
      scope: scope(),
      transport,
    });
    await client.listCategories();
    await client.listCategories();
    expect(resolutions).toBe(2);
    expect(requests).toHaveLength(2);
    expect(requests).toEqual([
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer live-secret" }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer live-secret" }),
      }),
    ]);
  });

  it("fails before transport when the scoped CredentialRef is unavailable", async () => {
    let called = false;
    const client = new CredentialResolvedFlutterwaveBillsClient({
      source: { async resolve() { return null; } },
      scope: scope(),
      transport: {
        async request() {
          called = true;
          throw new Error("must not run");
        },
      },
    });
    await expect(client.listCategories()).rejects.toMatchObject({
      code: "credential.unavailable",
    });
    expect(called).toBe(false);
  });
});
