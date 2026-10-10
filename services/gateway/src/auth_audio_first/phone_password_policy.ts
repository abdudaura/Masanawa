import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Phone ownership is NOT established by a password. E.164 only; callers format country codes. */
export function normalizePasswordPhone(phone: string): string {
  if (typeof phone !== "string" || !/^\+[1-9]\d{6,14}$/u.test(phone)) {
    throw new TypeError("PHONE_INVALID");
  }
  return phone;
}

/** Numeric passwords have a strictly bounded length, excluding predictable runs. */
export function assertNumericPassword(password: string, phone?: string): string {
  if (typeof password !== "string" || !/^\d{8,16}$/u.test(password)) {
    throw new TypeError("PASSWORD_INVALID");
  }
  if (/^(\d)\1+$/u.test(password) ||
      "01234567890123456789".includes(password) ||
      "98765432109876543210".includes(password) ||
      (phone && password === phone.replace(/\D/gu, "").slice(-password.length))) {
    throw new TypeError("PASSWORD_TOO_SIMPLE");
  }
  return password;
}

function derive(password: string, pepper: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password + "\0" + pepper, salt, 64,
      { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => error ? reject(error) : resolve(result));
  });
}

/** Salted memory-hard hash; pepper is a server secret, not stored in the database. */
export async function hashNumericPassword(password: string, pepper: string): Promise<string> {
  assertNumericPassword(password);
  if (typeof pepper !== "string" || pepper.length < 32) throw new TypeError("PASSWORD_PEPPER_REQUIRED");
  const salt = randomBytes(16);
  const key = await derive(password, pepper, salt);
  return `scrypt:v1:${salt.toString("hex")}:${key.toString("hex")}`;
}

/** Always performs a KDF even for an unknown account or malformed stored credential. */
export async function verifyNumericPassword(
  password: string, encoded: string | null, pepper: string,
): Promise<boolean> {
  if (typeof pepper !== "string" || pepper.length < 32) throw new TypeError("PASSWORD_PEPPER_REQUIRED");
  const valid = typeof encoded === "string" &&
    /^scrypt:v1:[0-9a-f]{32}:[0-9a-f]{128}$/u.test(encoded);
  const fields = valid ? encoded!.split(":") : [];
  const salt = Buffer.from(fields[2] ?? "00".repeat(16), "hex");
  const expected = Buffer.from(fields[3] ?? "00".repeat(64), "hex");
  const derived = await derive(typeof password === "string" ? password : "", pepper, salt);
  const validPassword = typeof password === "string" && /^\d{8,16}$/u.test(password);
  return Boolean(valid && validPassword && timingSafeEqual(derived, expected));
}
