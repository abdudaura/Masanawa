import {
  normalizePerceptionEvent,
  type PerceptionEvent,
} from "./perception-event.js";

export type MemoryPromotionDestination =
  | {
      readonly kind: "relationship";
      readonly relationshipId: string;
    }
  | {
      readonly kind: "character-private";
      readonly characterId: string;
    };

export interface MemoryPromotionReview {
  readonly reviewerUserId: string;
  readonly authorityContextId: string;
  readonly decision: "approve" | "deny";
  readonly reviewedAt: string;
  readonly reason: string;
}

export interface MemoryPromotionDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "source-not-durable"
    | "promotion-forbidden"
    | "permission-purpose-missing"
    | "review-denied"
    | "destination-widens-privacy"
    | "source-scope-unsupported";
  readonly destination: MemoryPromotionDestination | null;
  readonly reviewedAt: string;
}

function boundedString(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function canonicalLikeId(
  value: string,
  prefix: string,
  name: string,
): string {
  const normalized = boundedString(value, name, prefix.length + 8, 220);
  if (!normalized.startsWith(`${prefix}_`)) {
    throw new TypeError(`${name} must be a canonical ${prefix} id`);
  }
  return normalized;
}

function instant(value: string, name: string): string {
  const normalized = boundedString(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

function validateReview(review: MemoryPromotionReview): MemoryPromotionReview {
  return Object.freeze({
    reviewerUserId: canonicalLikeId(
      review.reviewerUserId,
      "user",
      "reviewerUserId",
    ),
    authorityContextId: canonicalLikeId(
      review.authorityContextId,
      "authority-context",
      "authorityContextId",
    ),
    decision:
      review.decision === "approve" || review.decision === "deny"
        ? review.decision
        : (() => {
            throw new TypeError("review.decision is invalid");
          })(),
    reviewedAt: instant(review.reviewedAt, "reviewedAt"),
    reason: boundedString(review.reason, "review.reason", 1, 500),
  });
}

function validateDestination(
  destination: MemoryPromotionDestination,
): MemoryPromotionDestination {
  if (destination.kind === "relationship") {
    return Object.freeze({
      kind: "relationship",
      relationshipId: canonicalLikeId(
        destination.relationshipId,
        "relationship",
        "destination.relationshipId",
      ),
    });
  }
  if (destination.kind === "character-private") {
    return Object.freeze({
      kind: "character-private",
      characterId: canonicalLikeId(
        destination.characterId,
        "character",
        "destination.characterId",
      ),
    });
  }
  throw new TypeError("destination.kind is invalid");
}

export function evaluatePerceptionMemoryPromotion(input: {
  readonly event: PerceptionEvent;
  readonly destination: MemoryPromotionDestination;
  readonly review: MemoryPromotionReview;
}): MemoryPromotionDecision {
  const event = normalizePerceptionEvent(input.event);
  const destination = validateDestination(input.destination);
  const review = validateReview(input.review);

  if (event.privacy.retention !== "durable") {
    return {
      allowed: false,
      reason: "source-not-durable",
      destination: null,
      reviewedAt: review.reviewedAt,
    };
  }

  if (event.privacy.memoryPromotion !== "review-required") {
    return {
      allowed: false,
      reason: "promotion-forbidden",
      destination: null,
      reviewedAt: review.reviewedAt,
    };
  }

  if (!event.permission.purposes.includes("memory-promotion")) {
    return {
      allowed: false,
      reason: "permission-purpose-missing",
      destination: null,
      reviewedAt: review.reviewedAt,
    };
  }

  if (review.decision !== "approve") {
    return {
      allowed: false,
      reason: "review-denied",
      destination: null,
      reviewedAt: review.reviewedAt,
    };
  }

  if (event.privacy.scope === "user-private") {
    return {
      allowed: false,
      reason: "source-scope-unsupported",
      destination: null,
      reviewedAt: review.reviewedAt,
    };
  }

  if (event.privacy.scope === "relationship") {
    if (
      destination.kind !== "relationship" ||
      event.subject.relationshipId === null ||
      destination.relationshipId !== event.subject.relationshipId
    ) {
      return {
        allowed: false,
        reason: "destination-widens-privacy",
        destination: null,
        reviewedAt: review.reviewedAt,
      };
    }
  }

  if (event.privacy.scope === "character-private") {
    if (
      destination.kind !== "character-private" ||
      event.subject.characterId === null ||
      destination.characterId !== event.subject.characterId
    ) {
      return {
        allowed: false,
        reason: "destination-widens-privacy",
        destination: null,
        reviewedAt: review.reviewedAt,
      };
    }
  }

  return {
    allowed: true,
    reason: "allowed",
    destination,
    reviewedAt: review.reviewedAt,
  };
}
