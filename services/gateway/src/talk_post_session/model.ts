/** U16 private post-session insight drafts; never a public replay or monetary receipt. */
export type InsightStatus = "eligible" | "processing" | "ready" | "failed";
export interface ReplayInsightSource {
  readonly tenantId: string;
  readonly talkId: string;
  readonly recordingId: string;
  readonly checksumSha256: string;
  readonly replayRevision: number;
  readonly hostUserId: string;
}
export interface ReplayInsightDraft {
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly nextTalkTitle: string | null;
}
export interface ReplayInsightView {
  readonly talkId: string;
  readonly recordingId: string;
  readonly status: InsightStatus;
  readonly summary: string | null;
  readonly highlights: readonly string[];
  readonly nextTalkTitle: string | null;
  readonly updatedAt: string;
}
export interface ReplayInsightClaim {
  readonly source: ReplayInsightSource;
  readonly leaseToken: string;
}
export interface ReplayInsightRepository {
  /** Returns null when authorization, recording consent, readiness or retention fails. */
  source(tenantId: string, userId: string, talkId: string): Promise<ReplayInsightSource | null>;
  /** Lease is acquired only for an eligible recording, atomically. */
  claim(source: ReplayInsightSource, userId: string, token: string): Promise<boolean>;
  /** Never returns a row whose replay has since been discarded, blocked or replaced. */
  read(tenantId: string, userId: string, talkId: string): Promise<ReplayInsightView | null>;
  /** Fences late workers against lease expiry and replay revocation. */
  complete(claim: ReplayInsightClaim, draft: ReplayInsightDraft): Promise<boolean>;
  fail(claim: ReplayInsightClaim): Promise<void>;
}
export interface ReplayInsightProcessor {
  /** Trusted backend worker fetches and validates R13 media; never accept a client transcript. */
  generate(source: ReplayInsightSource, signal: AbortSignal): Promise<ReplayInsightDraft>;
}
export interface ReplayInsightAuthorizer {
  authorize(input: { readonly authorizationHeader: string | undefined }): Promise<{
    readonly tenantId: string;
    readonly userId: string;
  }>;
}
