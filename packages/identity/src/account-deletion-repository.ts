import type { AccountDeletionPhase, AccountDeletionRequest } from "./account-deletion.js";

/** Database-backed, tenant-scoped request storage. Never expose worker transitions to clients. */
export interface AccountDeletionRepository {
  /** Idempotent for a user's current request; a second request cannot erase the first. */
  open(input: Readonly<{
    tenantId: string;
    userId: string;
    requestId: string;
    now: string;
  }>): Promise<AccountDeletionRequest>;
  read(input: Readonly<{ tenantId: string; userId: string }>): Promise<AccountDeletionRequest | null>;
  /** Trusted server/worker use only. Revision checked against the current stored row. */
  transition(input: Readonly<{
    tenantId: string;
    userId: string;
    expectedRevision: number;
    /** Verification is exclusively owned by the atomic challenge repository. */
    target: Exclude<AccountDeletionPhase, "requested" | "identity-verified">;
    now: string;
    cleanupComplete?: boolean;
    outstandingObligations?: readonly string[];
    errorCode?: string;
  }>): Promise<AccountDeletionRequest>;
}

/** Purpose-bound, rate-limited OTP challenges. Hashes are HMACs, never plain codes. */
export type AccountDeletionChallengeResult =
  | "accepted" | "invalid" | "missing" | "expired" | "locked";
export interface AccountDeletionChallengeRepository {
  put(input: Readonly<{
    tenantId: string; userId: string; requestId: string;
    codeHash: string; channel: "email" | "sms";
    now: string; expiresAt: string; resendAfter: string;
  }>): Promise<void>;
  /**
   * Single durable transaction: lock the request first, validate the challenge,
   * consume it, transition to identity-verified and append audit before commit.
   * On transaction failure the code remains usable. A successful result is
   * never returned unless the request and audit are durably updated.
   */
  verify(input: Readonly<{
    tenantId: string; userId: string; requestId: string;
    expectedRevision: number; codeHash: string; now: string;
  }>): Promise<
    | Readonly<{ result: "accepted"; request: AccountDeletionRequest }>
    | Readonly<{ result: Exclude<AccountDeletionChallengeResult, "accepted"> | "already-verified" | "conflict" }>
  >;
  cancel(input: Readonly<{
    tenantId: string; userId: string; codeHash: string;
  }>): Promise<void>;
}
