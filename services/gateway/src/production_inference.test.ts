import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseNurainImportedGeminiCredentialPool,
  verifyGeminiCredentialPool,
} from "./production_inference.js";

function encrypt(secret: string, root: string): string {
  const key = createHash("sha256").update(root).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function fingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 20);
}

describe("production Gemini imported credential bridge", () => {
  it("decrypts the Nurain envelope and verifies every fingerprint", () => {
    const encryptionKey = "portable-test-encryption-key-material-123456";
    const keys = [
      "AIzaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "AIzaBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    ];
    const importedCredentialsJson = JSON.stringify(
      keys.map((key) => ({
        encrypted_secret: encrypt(key, encryptionKey),
        fingerprint: fingerprint(key),
      })),
    );

    const pool = parseNurainImportedGeminiCredentialPool({
      importedCredentialsJson,
      encryptionKey,
      models: "gemini-3.8-flash,gemini-3.7-flash",
    });

    expect(pool.apiKeys).toEqual(keys);
    expect(pool.models).toEqual(["gemini-3.8-flash", "gemini-3.7-flash"]);
  });

  it("fails closed when the fingerprint does not match decrypted material", () => {
    const encryptionKey = "portable-test-encryption-key-material-123456";
    const key = "AIzaCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

    expect(() =>
      parseNurainImportedGeminiCredentialPool({
        importedCredentialsJson: JSON.stringify([
          {
            encrypted_secret: encrypt(key, encryptionKey),
            fingerprint: "00000000000000000000",
          },
        ]),
        encryptionKey,
        fallbackModel: "gemini-3.8-flash",
      }),
    ).toThrow("fingerprint mismatch");
  });
  it("requires at least one credential to authenticate", async () => {
    const seen: string[] = [];
    const result = await verifyGeminiCredentialPool({
      pool: {
        apiKeys: ["key-one", "key-two"],
        models: ["gemini-test-model"],
      },
      fetchImpl: (async (_url, init) => {
        const headers = new Headers(init?.headers);
        const key = headers.get("x-goog-api-key") ?? "";
        seen.push(key);
        return new Response(null, { status: key === "key-two" ? 200 : 401 });
      }) as typeof fetch,
    });

    expect(seen).toEqual(["key-one", "key-two"]);
    expect(result).toEqual({
      checked: 2,
      authenticated: 1,
      model: "gemini-test-model",
    });
  });
});
