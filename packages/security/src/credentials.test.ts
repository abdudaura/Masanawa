import {
  createCanonicalId,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  CredentialSecret,
  resolveCredentialSecret,
} from "./credentials.js";

describe("credential resolution security boundary", () => {
  it("redacts secret material from string and JSON surfaces", () => {
    const secret = CredentialSecret.fromString("never-log-this");

    expect(String(secret)).toBe("[REDACTED]");
    expect(JSON.stringify({ secret })).toBe('{"secret":"[REDACTED]"}');
    expect(secret.use((value) => value)).toBe("never-log-this");
  });

  it("fails inaccessible refs with one non-disclosing authorization error", async () => {
    const operationId = createCanonicalId("operation");

    await expect(
      resolveCredentialSecret(
        {
          async resolve() {
            return null;
          },
        },
        {
          tenantId: createCanonicalId("tenant"),
          credentialRefId: createCanonicalId("credential-ref"),
          providerId: createCanonicalId("provider"),
          operationId,
          slotKey: "api-key",
        },
      ),
    ).rejects.toMatchObject({
      code: "credential.unavailable",
      category: "authorization",
      retryable: false,
      operationId,
    });
  });
});
