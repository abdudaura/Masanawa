import { describe, expect, it, vi } from "vitest";
import {
  createWhatsAppAuthenticatedMediaEdge,
  type WhatsAppAuthenticatedMediaClient,
} from "./whatsapp-media-edge.js";

function client(input: {
  metadataFileId?: string;
  fileSize?: number | null;
  downloadBytes?: Uint8Array;
  metadataReject?: string;
  downloadReject?: string;
} = {}): WhatsAppAuthenticatedMediaClient {
  return {
    async getMedia({ fileId }) {
      if (input.metadataReject) {
        return { status: "rejected" as const, safeCode: input.metadataReject };
      }
      return {
        status: "accepted" as const,
        fileId: input.metadataFileId ?? fileId,
        mimeType: "audio/ogg",
        fileSize: input.fileSize ?? 4,
        downloadRef: "opaque-download-ref",
      };
    },
    async downloadMedia() {
      if (input.downloadReject) {
        return { status: "rejected" as const, safeCode: input.downloadReject };
      }
      return {
        status: "accepted" as const,
        bytes: input.downloadBytes ?? new Uint8Array([1,2,3,4]),
      };
    },
  };
}

describe("WhatsApp authenticated media edge", () => {
  it("performs metadata then bounded download without exposing the download reference", async () => {
    const c=client();
    const get=vi.spyOn(c,"getMedia");
    const dl=vi.spyOn(c,"downloadMedia");
    const edge=createWhatsAppAuthenticatedMediaEdge({client:c});
    await expect(edge.fetch({fileId:"m1",maximumBytes:1024})).resolves.toMatchObject({
      status:"accepted",fileId:"m1",mimeType:"audio/ogg"
    });
    expect(get).toHaveBeenCalledWith({fileId:"m1"});
    expect(dl).toHaveBeenCalledWith({downloadRef:"opaque-download-ref",maximumBytes:1024});
    expect(JSON.stringify(await edge.fetch({fileId:"m1",maximumBytes:1024}))).not.toContain("opaque-download-ref");
  });

  it("rejects metadata file substitution before download", async () => {
    const c=client({metadataFileId:"other"});
    const dl=vi.spyOn(c,"downloadMedia");
    await expect(createWhatsAppAuthenticatedMediaEdge({client:c}).fetch({fileId:"m1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"file_mismatch"});
    expect(dl).not.toHaveBeenCalled();
  });

  it("rejects provider-declared oversize media before download", async () => {
    const c=client({fileSize:2048});
    const dl=vi.spyOn(c,"downloadMedia");
    await expect(createWhatsAppAuthenticatedMediaEdge({client:c}).fetch({fileId:"m1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"file_too_large"});
    expect(dl).not.toHaveBeenCalled();
  });

  it("rejects byte count that disagrees with metadata", async () => {
    await expect(createWhatsAppAuthenticatedMediaEdge({client:client({fileSize:4,downloadBytes:new Uint8Array([1,2,3])})})
      .fetch({fileId:"m1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"file_size_mismatch"});
  });

  it("passes explicit provider rejection through unchanged", async () => {
    await expect(createWhatsAppAuthenticatedMediaEdge({client:client({metadataReject:"not_found"})})
      .fetch({fileId:"m1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"not_found"});
  });
});
