import { createHash, createDecipheriv } from "node:crypto";

/** One-time infrastructure credential bridge. No database or domain data access. */
export function decryptNurainGeminiCredentials(serialized, encryptionSecrets) {
  try {
    if (typeof serialized !== "string" || serialized.length > 65_536) throw new Error();
    const rows = JSON.parse(serialized);
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 32) throw new Error();
    const material = encryptionSecrets.filter(value => typeof value === "string" && value.length >= 32)
      .map(value => createHash("sha256").update(value).digest());
    if (!material.length || material.length > 8) throw new Error();
    const keys = rows.map(row => {
      if (!row || typeof row.encrypted_secret !== "string" || row.encrypted_secret.length > 2048 || typeof row.fingerprint !== "string") throw new Error();
      const [version, iv, tag, ciphertext, extra] = row.encrypted_secret.split(".");
      if (version !== "v1" || extra !== undefined || !iv || !tag || !ciphertext) throw new Error();
      const nonce = Buffer.from(iv, "base64url"), authTag = Buffer.from(tag, "base64url");
      if (nonce.length !== 12 || authTag.length !== 16) throw new Error();
      let plain;
      for (const key of material) {
        try {
          const decipher = createDecipheriv("aes-256-gcm", key, nonce);
          decipher.setAuthTag(authTag);
          plain = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
          break;
        } catch { /* Try only explicitly supplied current/previous encryption secrets. */ }
      }
      if (!plain || plain.length > 256 || /\s/u.test(plain) || createHash("sha256").update(plain).digest("hex").slice(0, 20) !== row.fingerprint) throw new Error();
      return plain;
    });
    if (new Set(keys).size !== keys.length) throw new Error();
    return Object.freeze(keys);
  } catch { throw new Error("Nurain Gemini credential import failed; verify the current/previous encryption secret and export format."); }
}
