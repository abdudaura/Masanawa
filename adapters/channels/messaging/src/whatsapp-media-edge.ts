import type { ChannelAuthenticatedMediaEdge } from "./media-fetch.js";

export interface WhatsAppAuthenticatedMediaClient {
  getMedia(input: {
    readonly fileId: string;
  }): Promise<
    | Readonly<{
        status: "accepted";
        fileId: string;
        mimeType: string;
        fileSize: number | null;
        downloadRef: string;
      }>
    | Readonly<{
        status: "rejected";
        safeCode: string;
      }>
  >;

  downloadMedia(input: {
    readonly downloadRef: string;
    readonly maximumBytes: number;
  }): Promise<
    | Readonly<{
        status: "accepted";
        bytes: Uint8Array;
      }>
    | Readonly<{
        status: "rejected";
        safeCode: string;
      }>
  >;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max || normalized.includes("\u0000")) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function optionalSize(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("WhatsApp media fileSize is invalid");
  }
  return value;
}

export function createWhatsAppAuthenticatedMediaEdge(input: {
  readonly client: WhatsAppAuthenticatedMediaClient;
}): ChannelAuthenticatedMediaEdge {
  return Object.freeze({
    async fetch(request) {
      const fileId = bounded(request.fileId, "fileId", 512);
      if (
        !Number.isSafeInteger(request.maximumBytes) ||
        request.maximumBytes < 1
      ) {
        throw new TypeError("maximumBytes is invalid");
      }

      const metadata = await input.client.getMedia({ fileId });
      if (metadata.status === "rejected") {
        return metadata;
      }

      const returnedFileId = bounded(metadata.fileId, "provider.fileId", 512);
      if (returnedFileId !== fileId) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "file_mismatch",
        });
      }

      const fileSize = optionalSize(metadata.fileSize);
      if (fileSize !== null && fileSize > request.maximumBytes) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "file_too_large",
        });
      }

      const downloadRef = bounded(
        metadata.downloadRef,
        "provider.downloadRef",
        4096,
      );
      const downloaded = await input.client.downloadMedia({
        downloadRef,
        maximumBytes: request.maximumBytes,
      });
      if (downloaded.status === "rejected") {
        return downloaded;
      }

      if (!(downloaded.bytes instanceof Uint8Array)) {
        throw new TypeError("WhatsApp media client returned invalid bytes");
      }
      if (
        downloaded.bytes.byteLength < 1 ||
        downloaded.bytes.byteLength > request.maximumBytes
      ) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "file_size_invalid",
        });
      }
      if (fileSize !== null && downloaded.bytes.byteLength !== fileSize) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "file_size_mismatch",
        });
      }

      return Object.freeze({
        status: "accepted" as const,
        fileId,
        mimeType: bounded(metadata.mimeType, "provider.mimeType", 256),
        bytes: Uint8Array.from(downloaded.bytes),
      });
    },
  });
}
