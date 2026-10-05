import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function childDirectories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe("simplified twin product architecture", () => {
  it("does not create a second canonical wallet, marketplace, social-feed or twin-runtime package", () => {
    const packages = childDirectories(path.resolve("packages"));
    const forbidden = packages.filter((name) =>
      /^(?:wallet|wallets|marketplace|marketplaces|social|social-feed|feed|feeds|twin|twins|clone-runtime|twin-runtime)$/u.test(
        name,
      ),
    );

    expect(
      forbidden,
      "Twin transformation must reuse Commerce/Agents/Identity instead of adding a parallel canonical subsystem",
    ).toEqual([]);
  });

  it("does not create standalone wallet, marketplace, social-feed or twin-runtime services", () => {
    const services = childDirectories(path.resolve("services"));
    const forbidden = services.filter((name) =>
      /^(?:wallet|wallet-service|marketplace|marketplace-service|social|social-feed|feed|twin-runtime|clone-runtime)$/u.test(
        name,
      ),
    );

    expect(
      forbidden,
      "Twin product capabilities belong in the existing Gateway/runtime ownership rather than new microservices",
    ).toEqual([]);
  });

  it("keeps the canonical shared foundations present", () => {
    const packages = new Set(childDirectories(path.resolve("packages")));
    expect(packages.has("commerce")).toBe(true);
    expect(packages.has("agents")).toBe(true);
    expect(packages.has("identity")).toBe(true);
    expect(packages.has("memory")).toBe(true);
    expect(packages.has("security")).toBe(true);
  });
});
