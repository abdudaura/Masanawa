import {
  normalizePlatformAuthIdentifier,
  type PlatformSessionRepository,
} from "@masanawa/security";
import type { CreditRecipientResolver } from "./credit_transfer.js";

export function createPlatformCreditRecipientResolver(input: {
  readonly sessions: PlatformSessionRepository;
  readonly now?: () => string;
}): CreditRecipientResolver {
  const now = input.now ?? (() => new Date().toISOString());

  return Object.freeze({
    async resolve(request) {
      const raw = request.recipient.trim();
      let normalized;
      try {
        normalized = raw.includes("@")
          ? normalizePlatformAuthIdentifier({ email: raw })
          : normalizePlatformAuthIdentifier({ phone: raw });
      } catch {
        throw new Error("Recipient must be a valid Masanawa email or phone number");
      }

      const profile = await input.sessions.resolveProfile({
        tenantId: request.tenantId as never,
        channel: normalized.channel,
        identifier: normalized.identifier,
        observedAt: now(),
      });

      if (!profile) {
        throw new Error("Recipient does not have a Masanawa account");
      }
      if (profile.userId === request.senderUserId) {
        throw new Error("Cannot transfer Credits to yourself");
      }

      return Object.freeze({
        recipientUserId: profile.userId,
      });
    },
  });
}
