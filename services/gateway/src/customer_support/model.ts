
export const supportOperationKinds = ["billing_quote", "crypto_intent"] as const;
export type SupportOperationKind = typeof supportOperationKinds[number];
export type SupportOperationPhase = "pending" | "succeeded" | "failed" | "refunded" | "unknown";

export interface VerifiedSupportOperation {
  readonly kind: SupportOperationKind;
  readonly reference: string;
  readonly phase: SupportOperationPhase;
  readonly observedAt: string;
}
export interface SupportOperationReader {
  // Must authorize exact tenant, user and reference against the canonical provider/domain owner.
  // A client-supplied reference must NEVER be treated as proof of operation ownership.
  read(input: Readonly<{
    tenantId: string;
    userId: string;
    authorizationHeader: string | undefined;
    kind: SupportOperationKind;
    reference: string;
  }>): Promise<VerifiedSupportOperation | null>;
}

export type SupportTicketStatus = "queued" | "reviewing" | "resolved" | "closed";
export interface SupportTicket {
  readonly id: string;
  readonly kind: SupportOperationKind | "general";
  readonly referenceMask: string | null;
  readonly operationPhase: SupportOperationPhase | null;
  readonly summary: string;
  readonly status: SupportTicketStatus;
  readonly resolution: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface SupportTicketStore {
  create(input: Readonly<{
    tenantId: string; userId: string; id: string; requestKey: string;
    requestDigest: string; kind: SupportTicket["kind"]; reference: string | null;
    referenceMask: string | null; operationPhase: SupportOperationPhase | null;
    summary: string; createdAt: string;
  }>): Promise<SupportTicket | null>;
  list(input: Readonly<{ tenantId: string; userId: string; limit: number }>): Promise<readonly SupportTicket[]>;
  read(input: Readonly<{ tenantId: string; userId: string; id: string }>): Promise<SupportTicket | null>;
}

export class SupportError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "SupportError";
  }
}

