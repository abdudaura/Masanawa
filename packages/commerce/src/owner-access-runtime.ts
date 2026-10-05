import {
  decideOwnerAccessSettlement,
  transitionOwnerAccess,
  type OwnerAccessQuote,
  type OwnerAccessRequest,
  type OwnerAccessState,
} from "./owner-access.js";

export interface OwnerAccessReservationPort {
  reserve(input: {
    readonly requestId: string;
    readonly requesterUserId: string;
    readonly amountCredits: number;
  }): Promise<{ readonly reservationId: string; readonly reservedCredits: number }>;

  release(input: {
    readonly requestId: string;
    readonly reservationId: string;
    readonly refundCredits: number;
  }): Promise<void>;

  settle(input: {
    readonly requestId: string;
    readonly reservationId: string;
    readonly customerChargeCredits: number;
    readonly ownerUserId: string;
    readonly ownerEarningCredits: number;
    readonly platformRevenueCredits: number;
  }): Promise<void>;
}

export interface OwnerAccessTrialUsagePort {
  /**
   * Must be idempotent by requestId + policyRevision. A replay after a
   * persistence failure must return success without consuming a second unit.
   */
  consume(input: {
    readonly requestId: string;
    readonly requesterUserId: string;
    readonly feature: "owner-access";
    readonly policyRevision: number;
    readonly units: number;
  }): Promise<void>;
}

export interface OwnerAccessNotificationPort {
  emit(input: {
    readonly requestId: string;
    readonly recipientUserId: string;
    readonly event:
      | "requested"
      | "accepted"
      | "declined"
      | "scheduled"
      | "started"
      | "completed"
      | "refunded"
      | "disputed";
    readonly scheduledFor?: string | null;
  }): Promise<void>;
}

export interface OwnerAccessRequestRepository {
  create(input: OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }): Promise<OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }>;

  get(input: {
    readonly requestId: string;
  }): Promise<
    | (OwnerAccessRequest & {
        readonly reservationId: string | null;
        readonly reservedCredits: number;
      })
    | null
  >;

  update(input: OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }): Promise<OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }>;
}

function addMinutes(at: string, minutes: number): string {
  const parsed = new Date(at);
  return new Date(parsed.getTime() + minutes * 60 * 1000).toISOString();
}

export function createOwnerAccessRuntime(input: {
  readonly repository: OwnerAccessRequestRepository;
  readonly reservations: OwnerAccessReservationPort;
  readonly trialUsage: OwnerAccessTrialUsagePort;
  readonly notifications?: OwnerAccessNotificationPort;
  readonly acceptWithinMinutes: number;
  readonly now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    async create(request: {
      readonly requesterUserId: string;
      readonly quote: OwnerAccessQuote;
    }) {
      const at = now().toISOString();
      const reservation =
        request.quote.chargeMode === "paid" && request.quote.priceCredits > 0
          ? await input.reservations.reserve({
              requestId: request.quote.requestId,
              requesterUserId: request.requesterUserId,
              amountCredits: request.quote.priceCredits,
            })
          : null;

      const created = await input.repository.create({
        requestId: request.quote.requestId,
        requesterUserId: request.requesterUserId,
        ownerUserId: request.quote.ownerUserId,
        originatingCharacterId: request.quote.originatingCharacterId,
        modality: request.quote.modality,
        durationMinutes: request.quote.durationMinutes,
        priceCredits: request.quote.priceCredits,
        platformFeeCredits: request.quote.platformFeeCredits,
        ownerEarningCredits: request.quote.ownerEarningCredits,
        chargeMode: request.quote.chargeMode,
        trialPolicyRevision: request.quote.trialPolicyRevision,
        state: "requested",
        requestedAt: at,
        acceptBy: addMinutes(at, input.acceptWithinMinutes),
        scheduledFor: null,
        startedAt: null,
        completedAt: null,
        reservationId: reservation?.reservationId ?? null,
        reservedCredits: reservation?.reservedCredits ?? 0,
      });
      await input.notifications?.emit({
        requestId: created.requestId,
        recipientUserId: created.ownerUserId,
        event: "requested",
      });
      return created;
    },

    async transition(request: {
      readonly requestId: string;
      readonly next: OwnerAccessState;
      readonly scheduledFor?: string;
      readonly attendanceVerified?: boolean;
      readonly completionVerified?: boolean;
    }) {
      const current = await input.repository.get({ requestId: request.requestId });
      if (!current) throw new Error("Owner access request not found");
      const next = transitionOwnerAccess(current.state, request.next);
      const at = now().toISOString();

      const settlement = decideOwnerAccessSettlement({
        state: next,
        chargeMode: current.chargeMode,
        reservedCredits: current.reservedCredits,
        ownerEarningCredits: current.ownerEarningCredits,
        platformFeeCredits: current.platformFeeCredits,
        attendanceVerified: request.attendanceVerified === true,
        completionVerified: request.completionVerified === true,
      });

      // Economic ports are required to be replay-safe by requestId. Execute
      // them before the state write so a persistence failure can retry the same
      // legal transition without duplicating money or trial consumption.
      if (
        settlement.disposition === "refund" &&
        current.reservationId !== null
      ) {
        await input.reservations.release({
          requestId: current.requestId,
          reservationId: current.reservationId,
          refundCredits: settlement.refundCredits,
        });
      } else if (
        settlement.disposition === "settle" &&
        current.chargeMode === "paid" &&
        current.reservationId !== null
      ) {
        await input.reservations.settle({
          requestId: current.requestId,
          reservationId: current.reservationId,
          customerChargeCredits: settlement.customerChargeCredits,
          ownerUserId: current.ownerUserId,
          ownerEarningCredits: settlement.ownerEarningCredits,
          platformRevenueCredits: settlement.platformRevenueCredits,
        });
      } else if (
        settlement.disposition === "settle" &&
        current.chargeMode === "trial" &&
        settlement.trialUnitsConsumed > 0
      ) {
        await input.trialUsage.consume({
          requestId: current.requestId,
          requesterUserId: current.requesterUserId,
          feature: "owner-access",
          policyRevision: current.trialPolicyRevision,
          units: settlement.trialUnitsConsumed,
        });
      }

      const updated = await input.repository.update({
        ...current,
        state: next,
        scheduledFor:
          next === "scheduled"
            ? request.scheduledFor ?? current.scheduledFor
            : current.scheduledFor,
        startedAt: next === "active" ? at : current.startedAt,
        completedAt: next === "completed" ? at : current.completedAt,
      });

      if (settlement.disposition === "refund") {
        await input.notifications?.emit({
          requestId: current.requestId,
          recipientUserId: current.requesterUserId,
          event: "refunded",
          scheduledFor: updated.scheduledFor,
        });
      }

      const event =
        next === "accepted"
          ? "accepted"
          : next === "declined"
            ? "declined"
            : next === "scheduled"
              ? "scheduled"
              : next === "active"
                ? "started"
                : next === "completed"
                  ? "completed"
                  : next === "disputed"
                    ? "disputed"
                    : null;
      if (event !== null) {
        await input.notifications?.emit({
          requestId: updated.requestId,
          recipientUserId:
            next === "accepted" || next === "declined" || next === "scheduled"
              ? updated.requesterUserId
              : updated.ownerUserId,
          event,
          scheduledFor: updated.scheduledFor,
        });
      }

      return Object.freeze({ request: updated, settlement });
    },

    async expire(requestId: string) {
      const current = await input.repository.get({ requestId });
      if (!current) throw new Error("Owner access request not found");
      if (current.state !== "requested" && current.state !== "accepted") {
        return Object.freeze({ request: current, expired: false });
      }
      if (new Date(current.acceptBy).getTime() > now().getTime()) {
        return Object.freeze({ request: current, expired: false });
      }

      const next = transitionOwnerAccess(current.state, "expired");
      const updated = await input.repository.update({
        ...current,
        state: next,
      });
      const settlement = decideOwnerAccessSettlement({
        state: next,
        chargeMode: current.chargeMode,
        reservedCredits: current.reservedCredits,
        ownerEarningCredits: current.ownerEarningCredits,
        platformFeeCredits: current.platformFeeCredits,
        attendanceVerified: false,
        completionVerified: false,
      });
      if (
        settlement.disposition === "refund" &&
        current.reservationId !== null
      ) {
        await input.reservations.release({
          requestId: current.requestId,
          reservationId: current.reservationId,
          refundCredits: settlement.refundCredits,
        });
        await input.notifications?.emit({
          requestId: current.requestId,
          recipientUserId: current.requesterUserId,
          event: "refunded",
          scheduledFor: current.scheduledFor,
        });
      }
      return Object.freeze({
        request: updated,
        expired: true,
        settlement,
      });
    },
  });
}
