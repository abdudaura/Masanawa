import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createS3ReplayObjectStorage } from "./s3_storage.js";

describe("private Talk replay object storage", () => {
  it("issues bounded signed playback URLs without exposing the storage secret", () => {
    const storage = createS3ReplayObjectStorage({
      endpoint: "https://ams3.digitaloceanspaces.com",
      bucket: "masanawa-replays",
      region: "ams3",
      accessKey: "ACCESS123",
      secret: "SUPERSECRET",
      forcePathStyle: false,
      now: () => new Date("2026-10-07T10:00:00.000Z"),
    });

    const signed = storage.presignGet({
      objectKey: "talk-replays/talk-1/replay.mp4",
      expiresSeconds: 300,
    });

    expect(signed.url).toContain("masanawa-replays.ams3.digitaloceanspaces.com");
    expect(signed.url).toContain("X-Amz-Signature=");
    expect(signed.url).not.toContain("SUPERSECRET");
    expect(signed.expiresAt).toBe("2026-10-07T10:05:00.000Z");
  });

  it("hashes the finished private replay before publication", async () => {
    const bytes = new TextEncoder().encode("verified replay bytes");
    const fetchImpl = vi.fn(async () =>
      new Response(bytes, { status: 200 }),
    );
    const storage = createS3ReplayObjectStorage({
      endpoint: "https://storage.example.test",
      bucket: "replays",
      region: "test-1",
      accessKey: "ACCESS123",
      secret: "SUPERSECRET",
      fetchImpl: fetchImpl as typeof fetch,
      now: () => new Date("2026-10-07T10:00:00.000Z"),
    });

    const result = await storage.sha256({
      objectKey: "talk-replays/talk-1/replay.mp4",
    });

    expect(result.byteLength).toBe(bytes.byteLength);
    expect(result.checksumSha256).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });
});
