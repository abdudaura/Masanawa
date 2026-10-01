import type { ChannelAccountId } from "./ids.js";
import type { Instant } from "./time.js";

export interface ExternalReference {
  readonly system: string;
  readonly namespace: string;
  readonly value: string;
  readonly observedAt: Instant;
  readonly expiresAt?: Instant;
  readonly provenance?: Readonly<Record<string, string>>;
}

export interface ExternalSubjectRef extends ExternalReference {
  readonly subjectKind: "user" | "group" | "channel" | "service" | "device" | "unknown";
  readonly accountId?: ChannelAccountId;
  readonly authenticationStrength: "unverified" | "transport-verified" | "linked" | "strong";
}

export interface ChannelConversationRef extends ExternalReference {
  readonly accountId: ChannelAccountId;
  readonly conversationKind: "direct" | "group" | "channel" | "thread" | "topic";
}
