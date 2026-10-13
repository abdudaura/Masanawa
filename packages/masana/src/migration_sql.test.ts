import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Fail immediately if an unregistered Masana migration cannot be parsed as
 * PL/pgSQL. PostgreSQL 18 fresh/upgrade execution remains the release gate.
 */
describe("Masana profile migration PL/pgSQL quoting", () => {
  const sql = readFileSync(new URL("../migrations/0001_masana_profiles.sql", import.meta.url), "utf8");

  it("pairs dollar-quoted declarations and terminators for all four triggers", () => {
    const functions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION\s+masana\.[a-z_]+\(\)\s+RETURNS trigger LANGUAGE plpgsql AS (\$\$)[\s\S]*?END; \1;/gu)];
    expect(functions).toHaveLength(4);
    expect(sql).not.toMatch(/\bAS \$(?!\$)/u);
    expect(sql).not.toMatch(/\bEND; \$(?!\$)/u);
  });
});
