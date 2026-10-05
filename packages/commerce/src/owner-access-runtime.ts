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

      return input.repository.create({
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

      const settlement = decideOwnerAccessSettlement({
        state: next,
        chargeMode: current.chargeMode,
        reservedCredits: current.reservedCredits,
        ownerEarningCredits: current.ownerEarningCredits,
        platformFeeCredits: current.platformFeeCredits,
        attendanceVerified: request.attendanceVerified === true,
        completionVerified: request.completionVerified === true,
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
      } else if (
        settlement.disposition === "settle" &&
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
      }

      return Object.freeze({ request: updated, settlement });
    },

    async expireDue() {
      const at = now();
      return { checkedAt: at.toISOString() };
    },
  });
}
