import { describe, expect, it } from "vitest";
import { platformProductMigrationRoots } from "./readiness.js";
import { readMigrationManifest } from "./migrations.js";

describe("AF00 canonical rebuilt product migration admission", () => {
  it("retains legacy financial owners and registers only one new root per domain", () => {
    const roots = platformProductMigrationRoots();
    const owners = roots.map((root) => root.owner);
    for (const domain of [
      "commerce", "identity", "agents", "talks", "masana",
      "feed", "external-videos", "masana-missions",
    ]) {
      expect(owners.filter((owner) => owner === domain), domain).toHaveLength(1);
    }
    for (const root of roots) {
      expect(root.directory).toMatch(/migrations[/\\]$/u);
    }
  });

  it("has immutable migration identities and dependency-ordered actual files", async () => {
    const manifest = await readMigrationManifest(platformProductMigrationRoots());
    const ids = manifest.map((m) => `${m.owner}/${m.name}`);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of manifest) {
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/u);
    }
    for (const id of [
      "masana/0001_masana_profiles.sql",
      "masana/0002_chat_inbox.sql",
      "masana/0006_message_hides.sql",
      "feed/0001_feed.sql",
      "feed/0003_saved_videos.sql",
      "feed/0004_editorial_review.sql",
      "external-videos/0001_external_videos.sql",
      "masana-missions/0001_missions.sql",
    ]) {
      expect(ids, `missing ${id}`).toContain(id);
    }
    // runMigrations sorts by owner then filename. The saved-video FK requires
    // official-video items, and Masana requires the existing identity schema.
    expect(ids.indexOf("external-videos/0001_external_videos.sql"))
      .toBeLessThan(ids.indexOf("feed/0003_saved_videos.sql"));
    expect(ids.indexOf("identity/0001_identity_foundation.sql"))
      .toBeLessThan(ids.indexOf("masana/0001_masana_profiles.sql"));
    expect(ids.indexOf("masana/0001_masana_profiles.sql"))
      .toBeLessThan(ids.indexOf("masana-missions/0001_missions.sql"));
  });
});
