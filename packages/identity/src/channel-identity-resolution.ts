import type {
  ChannelAccountId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import {
  assertChannelBindingUsable,
  type ChannelBindingProof,
  type ChannelBindingRepository,
  type LaunchChannelKind,
} from "./channel-binding.js";

export interface ResolvedChannelIdentity {
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly externalSubjectId: string;
  readonly bindingRevision: number;
  readonly proof: ChannelBindingProof;
}

export type ChannelIdentityResolution =
  | Readonly<{
      status: "resolved";
      identity: ResolvedChannelIdentity;
    }>
  | Readonly<{
      status: "unlinked";
      reason:
        | "account-not-found"
        | "account-unavailable"
        | "binding-not-found"
        | "binding-unusable";
    }>;

function boundedSubject(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("externalSubjectId must be a string");
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 512 ||
    normalized.includes("\u0000")
  ) {
    throw new TypeError("externalSubjectId is invalid");
  }
  return normalized;
}

function validChannel(value: LaunchChannelKind): LaunchChannelKind {
  if (value !== "whatsapp" && value !== "telegram") {
    throw new TypeError("channel is invalid");
  }
  return value;
}

export function createChannelIdentityResolver(input: {
  readonly repository: ChannelBindingRepository;
}) {
  return Object.freeze({
    async resolve(request: {
      readonly tenantId: TenantId;
      readonly channelAccountId: ChannelAccountId;
      readonly channel: LaunchChannelKind;
      readonly externalSubjectId: string;
    }): Promise<ChannelIdentityResolution> {
      const channel = validChannel(request.channel);
      const externalSubjectId = boundedSubject(request.externalSubjectId);

      const account = await input.repository.readAccount({
        tenantId: request.tenantId,
        channelAccountId: request.channelAccountId,
      });
      if (account === null) {
        return Object.freeze({
          status: "unlinked" as const,
          reason: "account-not-found" as const,
        });
      }
      if (
        account.tenantId !== request.tenantId ||
        account.channelAccountId !== request.channelAccountId ||
        account.channel !== channel ||
        account.state !== "active"
      ) {
        return Object.freeze({
          status: "unlinked" as const,
          reason: "account-unavailable" as const,
        });
      }

      const binding = await input.repository.readBindingBySubject({
        tenantId: request.tenantId,
        channelAccountId: request.channelAccountId,
        externalSubjectId,
      });
      if (binding === null) {
        return Object.freeze({
          status: "unlinked" as const,
          reason: "binding-not-found" as const,
        });
      }

      try {
        assertChannelBindingUsable({
          account,
          binding,
          tenantId: request.tenantId,
          externalSubjectId,
        });
      } catch {
        return Object.freeze({
          status: "unlinked" as const,
          reason: "binding-unusable" as const,
        });
      }

      if (binding.channel !== channel || binding.proof === null) {
        return Object.freeze({
          status: "unlinked" as const,
          reason: "binding-unusable" as const,
        });
      }

      return Object.freeze({
        status: "resolved" as const,
        identity: Object.freeze({
          tenantId: binding.tenantId,
          channelAccountId: binding.channelAccountId,
          channel: binding.channel,
          userId: binding.userId,
          externalSubjectId: binding.externalSubjectId,
          bindingRevision: binding.revision,
          proof: binding.proof,
        }),
      });
    },
  });
}
