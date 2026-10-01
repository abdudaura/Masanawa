import { createHash } from "node:crypto";

type CanonicalJsonPrimitive = null | boolean | number | string;
export type CanonicalJson =
  | CanonicalJsonPrimitive
  | readonly CanonicalJson[]
  | { readonly [key: string]: CanonicalJson };

function normalize(value: unknown, path: string): CanonicalJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite number is not canonical JSON at ${path}`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalize(item, `${path}[${index}]`));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const output: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined) {
        throw new TypeError(`Undefined is not canonical JSON at ${path}.${key}`);
      }
      output[key] = normalize(item, `${path}.${key}`);
    }
    return output;
  }

  throw new TypeError(`Unsupported canonical JSON value at ${path}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value, "$"));
}

export function fingerprintCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
