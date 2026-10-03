import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createCipheriv, randomBytes } from "node:crypto";
import { decryptNurainGeminiCredentials } from "./import-nurain-gemini.mjs";

const oldSecret = "old-migration-fixture-secret-32-characters";
const currentSecret = "current-migration-fixture-secret-32-characters";
function record(plain, secret = currentSecret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
  const bytes = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { encrypted_secret: `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${bytes.toString("base64url")}`, fingerprint: createHash("sha256").update(plain).digest("hex").slice(0, 20) };
}
test("imports all records with explicit current/previous secrets and fingerprint checks", () => {
  const rows = [record("fixture-first"), record("fixture-second", oldSecret)];
  const original = JSON.stringify(rows);
  const keys = decryptNurainGeminiCredentials(original, [currentSecret, oldSecret]);
  assert.deepEqual(keys, ["fixture-first", "fixture-second"]);
  assert.ok(Object.isFrozen(keys));
  assert.equal(JSON.stringify(rows), original);
});
test("rejects missing secrets, changed fingerprints, tampering and duplicates without partial import", () => {
  const row = record("fixture-private-key");
  for (const [rows, secrets] of [
    [[row], []], [[row], [oldSecret]],
    [[{ ...row, fingerprint: "wrong" }], [currentSecret]],
    [[{ ...row, encrypted_secret: row.encrypted_secret + ".invalid" }], [currentSecret]],
    [[row, row], [currentSecret]], [[], [currentSecret]],
  ]) {
    assert.throws(() => decryptNurainGeminiCredentials(JSON.stringify(rows), secrets), error => {
      assert.ok(!error.message.includes("fixture-private-key"));
      assert.ok(!error.message.includes(currentSecret));
      return /import failed/.test(error.message);
    });
  }
});
