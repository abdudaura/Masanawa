import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = path.resolve("apps/mobile");
const expectedApplicationId = "com.masanawa.app";
const retiredApplicationId = ["ng", "unigeria", "unigeria"].join(".");

function walk(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

describe("Masanawa mobile application identity", () => {
  it("uses the Masanawa application ID on Android and iOS", () => {
    const android = fs.readFileSync(
      path.join(mobileRoot, "android/app/build.gradle.kts"),
      "utf8",
    );
    const ios = fs.readFileSync(
      path.join(mobileRoot, "ios/Runner.xcodeproj/project.pbxproj"),
      "utf8",
    );

    expect(android).toContain(`applicationId = "${expectedApplicationId}"`);
    expect(android).toContain(`namespace = "${expectedApplicationId}"`);
    expect(ios).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${expectedApplicationId};`);
    expect(ios).toContain("GoogleService-Info.plist in Resources");
    expect(
      fs.existsSync(path.join(mobileRoot, "android/app/google-services.json")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(mobileRoot, "ios/Runner/GoogleService-Info.plist")),
    ).toBe(true);
  });

  it("contains no retired UNigeria application identity in mobile-owned files", () => {
    const offenders = walk(mobileRoot)
      .filter((file) => !file.includes(`${path.sep}build${path.sep}`))
      .filter((file) => fs.readFileSync(file).includes(retiredApplicationId))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
