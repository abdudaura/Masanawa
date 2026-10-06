import { describe, expect, it, vi } from "vitest";
import {
  createTelegramAuthenticatedMediaEdge,
  telegramBotApiDownloadLimitBytes,
  type TelegramAuthenticatedFileClient,
} from "./telegram-media-edge.js";

function client(input: {
  metadataFileId?: string;
  fileSize?: number | null;
  downloadBytes?: Uint8Array;
  getReject?: string;
} = {}): TelegramAuthenticatedFileClient {
  return {
    async getFile({fileId}) {
      if(input.getReject) return {status:"rejected" as const,safeCode:input.getReject};
      return {
        status:"accepted" as const,
        fileId:input.metadataFileId??fileId,
        filePath:"opaque/file/path",
        fileSize:input.fileSize??4,
      };
    },
    async downloadFile() {
      return {
        status:"accepted" as const,
        mimeType:"audio/ogg",
        bytes:input.downloadBytes??new Uint8Array([1,2,3,4]),
      };
    },
  };
}

describe("Telegram authenticated media edge", () => {
  it("performs getFile then bounded file download", async () => {
    const c=client();
    const dl=vi.spyOn(c,"downloadFile");
    await expect(createTelegramAuthenticatedMediaEdge({client:c}).fetch({fileId:"tg1",maximumBytes:1024}))
      .resolves.toMatchObject({status:"accepted",fileId:"tg1",mimeType:"audio/ogg"});
    expect(dl).toHaveBeenCalledWith({filePath:"opaque/file/path",maximumBytes:1024});
  });

  it("caps download requests at the Bot API 20 MB limit", async () => {
    const c=client({fileSize:null,downloadBytes:new Uint8Array([1])});
    const dl=vi.spyOn(c,"downloadFile");
    await createTelegramAuthenticatedMediaEdge({client:c}).fetch({
      fileId:"tg1",
      maximumBytes:telegramBotApiDownloadLimitBytes+1024,
    });
    expect(dl).toHaveBeenCalledWith({
      filePath:"opaque/file/path",
      maximumBytes:telegramBotApiDownloadLimitBytes,
    });
  });

  it("rejects provider-declared files above the effective limit before download", async () => {
    const c=client({fileSize:telegramBotApiDownloadLimitBytes+1});
    const dl=vi.spyOn(c,"downloadFile");
    await expect(createTelegramAuthenticatedMediaEdge({client:c}).fetch({
      fileId:"tg1",maximumBytes:telegramBotApiDownloadLimitBytes+9999
    })).resolves.toEqual({status:"rejected",safeCode:"file_too_large"});
    expect(dl).not.toHaveBeenCalled();
  });

  it("rejects file-id substitution and byte-count mismatch", async () => {
    await expect(createTelegramAuthenticatedMediaEdge({client:client({metadataFileId:"other"})})
      .fetch({fileId:"tg1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"file_mismatch"});

    await expect(createTelegramAuthenticatedMediaEdge({client:client({fileSize:4,downloadBytes:new Uint8Array([1,2])})})
      .fetch({fileId:"tg1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"file_size_mismatch"});
  });

  it("passes getFile rejection through unchanged", async () => {
    await expect(createTelegramAuthenticatedMediaEdge({client:client({getReject:"file_not_found"})})
      .fetch({fileId:"tg1",maximumBytes:1024}))
      .resolves.toEqual({status:"rejected",safeCode:"file_not_found"});
  });
});
