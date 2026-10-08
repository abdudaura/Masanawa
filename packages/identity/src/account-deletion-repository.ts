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
    target: AccountDeletionPhase;
    now: string;
    identityReauthenticated?: boolean;
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
  consume(input: Readonly<{
    tenantId: string; userId: string; requestId: string;
    codeHash: string; now: string;
  }>): Promise<AccountDeletionChallengeResult>;
  cancel(input: Readonly<{
    tenantId: string; userId: string; codeHash: string;
  }>): Promise<void>;
}
