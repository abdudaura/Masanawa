import type { Instant, TenantId, UserId } from "@masanawa/contracts";

export type TalkId = string & { readonly __talkId: unique symbol };
export type TalkSeatId = string & { readonly __talkSeatId: unique symbol };
export type TalkPersonaId = string & { readonly __talkPersonaId: unique symbol };

export type TalkSeatKind = "human" | "expert" | "twin";
export type TalkSeatRole = "host" | "speaker";
export type TalkLiveState = "live" | "host_reconnecting" | "ended";
export type TalkAiTurnState = "enabled" | "paused";
export type TalkLiveEndReason = "host_grace_expired" | "host_ended" | "platform_ended";

export interface TalkLivePolicy {
  readonly maxActiveSeats: number;
  readonly maxAiSeats: number;
  readonly hostReconnectGraceMs: number;
}

export const launchTalkLivePolicy: TalkLivePolicy = Object.freeze({
  maxActiveSeats: 6,
  maxAiSeats: 3,
  hostReconnectGraceMs: 30_000,
});

interface TalkSeatBase {
  readonly seatId: TalkSeatId;
  readonly kind: TalkSeatKind;
  readonly role: TalkSeatRole;
  readonly connected: boolean;
  readonly admittedAt: Instant;
}

export interface HumanTalkSeat extends TalkSeatBase {
  readonly kind: "human";
  readonly userId: UserId;
}

export interface AiTalkSeat extends TalkSeatBase {
  readonly kind: "expert" | "twin";
  readonly role: "speaker";
  readonly personaId: TalkPersonaId;
  /**
   * Opaque evidence that a higher commercial authority admitted this paid AI Seat.
   * This runtime never interprets, charges, refunds, or settles it.
   */
  readonly commercialAuthorizationId: string;
}

export type TalkSeat = HumanTalkSeat | AiTalkSeat;

export interface TalkLiveSession {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly hostUserId: UserId;
  readonly hostSeatId: TalkSeatId;
  readonly state: TalkLiveState;
  readonly aiTurns: TalkAiTurnState;
  readonly seats: readonly TalkSeat[];
  readonly revision: number;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly hostReconnectDeadline: Instant | null;
  readonly endedAt: Instant | null;
  readonly endReason: TalkLiveEndReason | null;
}

export type TalkLiveCommand =
  | { readonly type: "host_disconnected"; readonly expectedRevision: number }
  | { readonly type: "host_reconnected"; readonly expectedRevision: number }
  | { readonly type: "host_grace_expired"; readonly expectedRevision: number }
  | {
      readonly type: "human_seat_admitted";
      readonly expectedRevision: number;
      readonly seatId: TalkSeatId;
      readonly userId: UserId;
    }
  | {
      readonly type: "ai_seat_admitted";
      readonly expectedRevision: number;
      readonly seatId: TalkSeatId;
      readonly kind: "expert" | "twin";
      readonly personaId: TalkPersonaId;
      readonly commercialAuthorizationId: string;
    }
  | {
      readonly type: "seat_removed";
      readonly expectedRevision: number;
      readonly seatId: TalkSeatId;
    }
  | {
      readonly type: "ended";
      readonly expectedRevision: number;
      readonly reason: "host_ended" | "platform_ended";
    };

export type TalkLiveEventType =
  | "host_disconnected"
  | "host_reconnected"
  | "host_grace_expired"
  | "human_seat_admitted"
  | "ai_seat_admitted"
  | "seat_removed"
  | "ended";

export interface TalkLiveEvent {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly type: TalkLiveEventType;
  readonly revision: number;
  readonly occurredAt: Instant;
  readonly seatId?: TalkSeatId;
}

export interface TalkLiveTransition {
  readonly session: TalkLiveSession;
  readonly event: TalkLiveEvent;
}

export interface CreateTalkLiveSessionInput {
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly hostUserId: UserId;
  readonly hostSeatId: TalkSeatId;
  readonly startedAt: Instant;
}
