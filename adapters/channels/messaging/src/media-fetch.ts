import { createHash } from "node:crypto";
import {
  PlatformError,
  parseCanonicalId,
  type ChannelAccountId,
} from "@masanawa/contracts";
import type { MessagingChannel } from "./model.js";

export type ChannelInboundMediaKind =
  | "audio"
  | "image"
  | "video"
  | "document";

export interface ChannelInboundMediaFetchRequest {
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  readonly fileId: string;
  readonly mediaKind: ChannelInboundMediaKind;
  readonly declaredMimeType?: string;
}

export interface ChannelFetchedMedia {
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  readonly fileId: string;
  readonly mediaKind: ChannelInboundMediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly bytes: Uint8Array;
}

export interface ChannelAuthenticatedMediaEdge {
  /**
   * Provider credentials, authenticated download URLs and redirects stay inside
   * this edge. The adapter receives only bounded media bytes + safe metadata.
   *
   * Explicit provider/API rejection is returned. Network/ambiguous failures throw.
   */
  fetch(input: {
    readonly fileId: string;
    readonly maximumBytes: number;
  }): Promise<
    | Readonly<{
        status: "accepted";
        fileId: string;
        mimeType: string;
        bytes: Uint8Array;
      }>
    | Readonly<{
        status: "rejected";
        safeCode: string;
      }>
  >;
}

export interface ChannelMediaLimits {
  readonly audio: number;
  readonly image: number;
  readonly video: number;
  readonly document: number;
}

export interface AuthorizedChannelMediaFetcherConfig {
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  readonly edge: ChannelAuthenticatedMediaEdge;
  readonly limits: ChannelMediaLimits;
}

const hardMaximumBytes = 64 * 1024 * 1024;

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > max ||
    normalized.includes("\u0000")
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function mime(value: string, name: string): string {
  const normalized = bounded(value, name, 256).toLowerCase();
  if (
    !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;\s*[a-z0-9!#$&^_.+-]+=[^;]{1,128})*$/u.test(
      normalized,
    )
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function baseMime(value: string): string {
  return value.split(";", 1)[0]!.trim().toLowerCase();
}

function limit(value: number, name: string): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > hardMaximumBytes
  ) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function safeCode(value: string): string {
  const normalized = bounded(value, "safeCode", 128);
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(normalized)) {
    throw new TypeError("safeCode is invalid");
  }
  return normalized;
}

function mediaError(
  code: string,
  category:
    | "validation"
    | "authorization"
    | "conflict"
    | "not-found"
    | "unavailable",
  message: string,
  retryable = false,
): PlatformError {
  return new PlatformError({
    code: `channels.${code}`,
    category,
    message,
    retryable,
  });
}

function kindPrefix(kind: ChannelInboundMediaKind): string | null {
  switch (kind) {
    case "audio":
      return "audio/";
    case "image":
      return "image/";
    case "video":
      return "video/";
    case "document":
      return null;
  }
}

function assertKindMime(
  kind: ChannelInboundMediaKind,
  actualMimeType: string,
): void {
  const prefix = kindPrefix(kind);
  if (prefix !== null && !baseMime(actualMimeType).startsWith(prefix)) {
    throw mediaError(
      "media_kind_mismatch",
      "validation",
      "Fetched channel media does not match the admitted media kind",
    );
  }
}

export function createAuthorizedChannelMediaFetcher(
  input: AuthorizedChannelMediaFetcherConfig,
) {
  if (input.channel !== "whatsapp" && input.channel !== "telegram") {
    throw new TypeError("channel is invalid");
  }
  const accountId = parseCanonicalId("channel-account", input.accountId);
  const limits = Object.freeze({
    audio: limit(input.limits.audio, "limits.audio"),
    image: limit(input.limits.image, "limits.image"),
    video: limit(input.limits.video, "limits.video"),
    document: limit(input.limits.document, "limits.document"),
  });

  return Object.freeze({
    async fetch(
      request: ChannelInboundMediaFetchRequest,
    ): Promise<ChannelFetchedMedia> {
      if (
        request.channel !== input.channel ||
        request.accountId !== accountId
      ) {
        throw mediaError(
          "media_scope_mismatch",
          "authorization",
          "Channel media request does not match the configured account scope",
        );
      }

      const fileId = bounded(request.fileId, "fileId", 512);
      const declaredMimeType =
        request.declaredMimeType === undefined
          ? null
          : mime(request.declaredMimeType, "declaredMimeType");
      const maximumBytes = limits[request.mediaKind];

      let response: Awaited<
        ReturnType<ChannelAuthenticatedMediaEdge["fetch"]>
      >;
      try {
        response = await input.edge.fetch({
          fileId,
          maximumBytes,
        });
      } catch {
        throw mediaError(
          "media_fetch_unavailable",
          "unavailable",
          "Channel media fetch is unavailable",
          true,
        );
      }

      if (response.status === "rejected") {
        let code = "provider_rejected";
        try {
          code = safeCode(response.safeCode);
        } catch {
          code = "provider_rejected";
        }
        throw mediaError(
          `media_${code}`,
          code.includes("not_found") ? "not-found" : "unavailable",
          "Channel provider rejected the media fetch",
          false,
        );
      }

      const returnedFileId = bounded(response.fileId, "provider.fileId", 512);
      if (returnedFileId !== fileId) {
        throw mediaError(
          "media_file_mismatch",
          "authorization",
          "Fetched channel media does not match the requested provider file",
        );
      }

      const actualMimeType = mime(response.mimeType, "provider.mimeType");
      assertKindMime(request.mediaKind, actualMimeType);
      if (
        declaredMimeType !== null &&
        baseMime(declaredMimeType) !== baseMime(actualMimeType)
      ) {
        throw mediaError(
          "media_mime_mismatch",
          "conflict",
          "Fetched channel media MIME type differs from webhook evidence",
        );
      }

      if (!(response.bytes instanceof Uint8Array)) {
        throw mediaError(
          "media_fetch_invalid",
          "unavailable",
          "Channel provider returned invalid media bytes",
          true,
        );
      }
      const sizeBytes = response.bytes.byteLength;
      if (sizeBytes < 1 || sizeBytes > maximumBytes) {
        throw mediaError(
          "media_size_invalid",
          "validation",
          "Fetched channel media is empty or exceeds the admitted size limit",
        );
      }

      const bytes = Uint8Array.from(response.bytes);
      const contentHash =
        `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

      return Object.freeze({
        channel: input.channel,
        accountId,
        fileId,
        mediaKind: request.mediaKind,
        mimeType: actualMimeType,
        sizeBytes,
        contentHash,
        bytes,
      });
    },
  });
}

export function createWhatsAppInboundMediaFetcher(
  input: Omit<AuthorizedChannelMediaFetcherConfig, "channel">,
) {
  return createAuthorizedChannelMediaFetcher({
    ...input,
    channel: "whatsapp",
  });
}

export function createTelegramInboundMediaFetcher(
  input: Omit<AuthorizedChannelMediaFetcherConfig, "channel">,
) {
  return createAuthorizedChannelMediaFetcher({
    ...input,
    channel: "telegram",
  });
}
