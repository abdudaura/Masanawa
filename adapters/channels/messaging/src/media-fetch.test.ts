import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createAuthorizedChannelMediaFetcher,
  createTelegramInboundMediaFetcher,
  createWhatsAppInboundMediaFetcher,
  type ChannelAuthenticatedMediaEdge,
} from "./media-fetch.js";

const accountId = createCanonicalId("channel-account");

function edge(input: {
  fileId?: string;
  mimeType?: string;
  bytes?: Uint8Array;
  rejected?: string;
  throws?: boolean;
} = {}): ChannelAuthenticatedMediaEdge {
  return {
    async fetch(request) {
      if (input.throws) throw new Error("private provider token leaked");
      if (input.rejected) {
        return {
          status: "rejected" as const,
          safeCode: input.rejected,
        };
      }
      return {
        status: "accepted" as const,
        fileId: input.fileId ?? request.fileId,
        mimeType: input.mimeType ?? "audio/ogg",
        bytes: input.bytes ?? new Uint8Array([1, 2, 3, 4]),
      };
    },
  };
}

const limits = {
  audio: 1024,
  image: 2048,
  video: 4096,
  document: 8192,
} as const;

describe("authorized channel media fetch", () => {
  it("fetches scoped bytes and returns stable SHA-256 evidence", async () => {
    const provider = edge();
    const spy = vi.spyOn(provider, "fetch");
    const fetcher = createAuthorizedChannelMediaFetcher({
      channel: "whatsapp",
      accountId,
      edge: provider,
      limits,
    });

    const result = await fetcher.fetch({
      channel: "whatsapp",
      accountId,
      fileId: "wa-media-1",
      mediaKind: "audio",
      declaredMimeType: "audio/ogg",
    });

    expect(result).toMatchObject({
      channel: "whatsapp",
      accountId,
      fileId: "wa-media-1",
      mediaKind: "audio",
      mimeType: "audio/ogg",
      sizeBytes: 4,
      contentHash:
        "sha256:9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    });
    expect([...result.bytes]).toEqual([1, 2, 3, 4]);
    expect(spy).toHaveBeenCalledWith({
      fileId: "wa-media-1",
      maximumBytes: 1024,
    });
  });

  it("rejects channel-account substitution before provider fetch", async () => {
    const provider = edge();
    const spy = vi.spyOn(provider, "fetch");
    const fetcher = createWhatsAppInboundMediaFetcher({
      accountId,
      edge: provider,
      limits,
    });

    await expect(
      fetcher.fetch({
        channel: "telegram",
        accountId,
        fileId: "wrong-scope",
        mediaKind: "audio",
      }),
    ).rejects.toMatchObject({
      code: "channels.media_scope_mismatch",
      category: "authorization",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects provider file substitution", async () => {
    const fetcher = createTelegramInboundMediaFetcher({
      accountId,
      edge: edge({ fileId: "different-file" }),
      limits,
    });

    await expect(
      fetcher.fetch({
        channel: "telegram",
        accountId,
        fileId: "telegram-file-1",
        mediaKind: "audio",
      }),
    ).rejects.toMatchObject({
      code: "channels.media_file_mismatch",
      category: "authorization",
    });
  });

  it("rejects media-kind and webhook MIME mismatches", async () => {
    const imageFetcher = createWhatsAppInboundMediaFetcher({
      accountId,
      edge: edge({ mimeType: "application/pdf" }),
      limits,
    });
    await expect(
      imageFetcher.fetch({
        channel: "whatsapp",
        accountId,
        fileId: "image-1",
        mediaKind: "image",
      }),
    ).rejects.toMatchObject({
      code: "channels.media_kind_mismatch",
      category: "validation",
    });

    const mimeFetcher = createWhatsAppInboundMediaFetcher({
      accountId,
      edge: edge({ mimeType: "audio/ogg" }),
      limits,
    });
    await expect(
      mimeFetcher.fetch({
        channel: "whatsapp",
        accountId,
        fileId: "audio-1",
        mediaKind: "audio",
        declaredMimeType: "audio/mpeg",
      }),
    ).rejects.toMatchObject({
      code: "channels.media_mime_mismatch",
      category: "conflict",
    });
  });

  it("rejects empty and oversize provider payloads", async () => {
    const empty = createTelegramInboundMediaFetcher({
      accountId,
      edge: edge({ bytes: new Uint8Array() }),
      limits,
    });
    await expect(
      empty.fetch({
        channel: "telegram",
        accountId,
        fileId: "audio-empty",
        mediaKind: "audio",
      }),
    ).rejects.toMatchObject({ code: "channels.media_size_invalid" });

    const huge = createTelegramInboundMediaFetcher({
      accountId,
      edge: edge({ bytes: new Uint8Array(1025) }),
      limits,
    });
    await expect(
      huge.fetch({
        channel: "telegram",
        accountId,
        fileId: "audio-huge",
        mediaKind: "audio",
      }),
    ).rejects.toMatchObject({ code: "channels.media_size_invalid" });
  });

  it("maps explicit provider rejection without exposing private provider details", async () => {
    const fetcher = createWhatsAppInboundMediaFetcher({
      accountId,
      edge: edge({ rejected: "media_not_found" }),
      limits,
    });

    try {
      await fetcher.fetch({
        channel: "whatsapp",
        accountId,
        fileId: "missing",
        mediaKind: "document",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: "channels.media_provider_rejected",
        category: "not-found",
        retryable: false,
      });
      expect(JSON.stringify(error)).not.toContain("token");
    }
  });

  it("redacts ambiguous provider/network failures and keeps them retryable", async () => {
    const fetcher = createTelegramInboundMediaFetcher({
      accountId,
      edge: edge({ throws: true }),
      limits,
    });

    try {
      await fetcher.fetch({
        channel: "telegram",
        accountId,
        fileId: "retry-me",
        mediaKind: "document",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: "channels.media_fetch_unavailable",
        category: "unavailable",
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain("provider token");
    }
  });

  it("copies provider-owned bytes before returning them", async () => {
    const source = new Uint8Array([7, 8, 9]);
    const fetcher = createWhatsAppInboundMediaFetcher({
      accountId,
      edge: edge({ bytes: source }),
      limits,
    });

    const result = await fetcher.fetch({
      channel: "whatsapp",
      accountId,
      fileId: "copy-test",
      mediaKind: "audio",
    });
    source[0] = 0;
    expect([...result.bytes]).toEqual([7, 8, 9]);
  });

  it("validates configured byte limits eagerly", () => {
    expect(() =>
      createTelegramInboundMediaFetcher({
        accountId,
        edge: edge(),
        limits: { ...limits, video: 100 * 1024 * 1024 },
      }),
    ).toThrow(/limits.video/);
  });
});
