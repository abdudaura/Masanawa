import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return walk(full);
    }
    return entry.isFile() && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(entry.name)
      ? [full]
      : [];
  });
}

describe("reference vault isolation", () => {
  it("production code never imports references/sources", () => {
    const productionRoots = ["packages", "services", "apps", "adapters"];
    const offenders: string[] = [];

    for (const root of productionRoots) {
      for (const file of walk(path.resolve(root))) {
        const source = fs.readFileSync(file, "utf8");
        if (
          source.includes("references/sources") ||
          /from\s+["'][^"']*references\//u.test(source)
        ) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
