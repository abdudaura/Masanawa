import type { ChannelAuthenticatedMediaEdge } from "./media-fetch.js";

export interface TelegramAuthenticatedFileClient {
  getFile(input: {
    readonly fileId: string;
  }): Promise<
    | Readonly<{
        status: "accepted";
        fileId: string;
        filePath: string;
        fileSize: number | null;
      }>
    | Readonly<{
        status: "rejected";
        safeCode: string;
      }>
  >;

  downloadFile(input: {
    readonly filePath: string;
    readonly maximumBytes: number;
  }): Promise<
    | Readonly<{
        status: "accepted";
        mimeType: string;
        bytes: Uint8Array;
      }>
    | Readonly<{
        status: "rejected";
        safeCode: string;
      }>
  >;
}

const telegramBotApiDownloadLimitBytes = 20 * 1024 * 1024;

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
    throw new TypeError("Telegram fileSize is invalid");
  }
  return value;
}

export function createTelegramAuthenticatedMediaEdge(input: {
  readonly client: TelegramAuthenticatedFileClient;
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
      const maximumBytes = Math.min(
        request.maximumBytes,
        telegramBotApiDownloadLimitBytes,
      );

      const metadata = await input.client.getFile({ fileId });
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
      if (fileSize !== null && fileSize > maximumBytes) {
        return Object.freeze({
          status: "rejected" as const,
          safeCode: "file_too_large",
        });
      }

      const filePath = bounded(metadata.filePath, "provider.filePath", 2048);
      const downloaded = await input.client.downloadFile({
        filePath,
        maximumBytes,
      });
      if (downloaded.status === "rejected") {
        return downloaded;
      }

      if (!(downloaded.bytes instanceof Uint8Array)) {
        throw new TypeError("Telegram file client returned invalid bytes");
      }
      if (
        downloaded.bytes.byteLength < 1 ||
        downloaded.bytes.byteLength > maximumBytes
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
        mimeType: bounded(downloaded.mimeType, "provider.mimeType", 256),
        bytes: Uint8Array.from(downloaded.bytes),
      });
    },
  });
}

export { telegramBotApiDownloadLimitBytes };
