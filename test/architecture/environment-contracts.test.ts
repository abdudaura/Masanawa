import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface EnvEntry {
  readonly name: string;
  readonly owner: string;
  readonly classification: "public" | "secret";
  readonly requiredIn: readonly ("development" | "test" | "production")[];
  readonly description: string;
}
interface Registry { readonly schemaVersion: number; readonly variables: readonly EnvEntry[]; }

function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

describe("production environment contracts", () => {
  const registry = JSON.parse(fs.readFileSync("config/production-env.json", "utf8")) as Registry;
  const entries = new Map(registry.variables.map((entry) => [entry.name, entry]));

  it("keeps one valid machine-readable registry with no duplicate variables", () => {
    expect(registry.schemaVersion).toBe(1);
    expect(entries.size).toBe(registry.variables.length);
    for (const entry of registry.variables) {
      expect(entry.name).toMatch(/^(?:MASANAWA_[A-Z0-9_]+|CREDENTIAL_[A-Z0-9_]+|FLUTTERWAVE_[A-Z0-9_]+|GEMINI_[A-Z0-9_]+|NOWPAYMENTS_[A-Z0-9_]+|RAILWAY_[A-Z0-9_]+|SUPABASE_[A-Z0-9_]+|LIVEKIT_(?:API_KEY|API_SECRET|URL)|NODE_ENV|HOST|PORT|DATABASE_URL|RESEND_API_KEY|NEXT_PUBLIC_OPS_API_BASE_URL)$/u);
      expect(entry.owner.trim()).not.toBe("");
      expect(entry.description.trim()).not.toBe("");
      expect(["public", "secret"]).toContain(entry.classification);
      expect(new Set(entry.requiredIn).size).toBe(entry.requiredIn.length);
    }
  });

  it("registers every environment variable read by production TypeScript source", () => {
    const roots = ["packages", "services", "apps", "adapters", "infra"];
    const names = new Set<string>();
    const access = /(?:process\.env|\benv)\.([A-Z][A-Z0-9_]+)/gu;
    for (const root of roots) {
      for (const file of walk(root).filter((name) => /\.[cm]?[jt]sx?$/u.test(name) && !/\.(?:test|spec)\./u.test(name))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(access)) names.add(match[1]!);
      }
    }
    expect([...names].filter((name) => !entries.has(name)).sort()).toEqual([]);
  });

  it("keeps domain packages independent from process environment", () => {
    for (const file of walk("packages").filter((name) => /\/src\/.*\.[cm]?[jt]sx?$/u.test(name))) {
      expect(fs.readFileSync(file, "utf8"), file).not.toMatch(/process\.env/u);
    }
  });

  it("classifies database bootstrap values as secrets without storing values", () => {
    expect(entries.get("MASANAWA_DATABASE_URL")?.classification).toBe("secret");
    expect(entries.get("DATABASE_URL")?.classification).toBe("secret");
    const serialized = JSON.stringify(registry);
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//iu);
  });
});

