/** C01 human-only contact discovery. No PersonaId or public Talk membership. */
export type HumanContactPolicy = "anyone" | "requests" | "nobody";
export type HumanContactStatus = "none" | "incoming" | "outgoing" | "accepted" | "declined" | "revoked";
export interface HumanContactPreferences {
  readonly policy: HumanContactPolicy;
  readonly discoverableByHandle: boolean;
}

export interface HumanContact {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  /** Subject's policy is private: expose action eligibility instead, never preference metadata. */
  readonly canMessage: boolean;
  /** Current invitation revision. Required to accept/decline; null without an edge. */
  readonly requestRevision: string | null;
  readonly status: HumanContactStatus;
}
export interface HumanContactRequest {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly status: Exclude<HumanContactStatus, "none">;
  readonly updatedAt: string;
  readonly requestRevision: string;
}
/** PostgreSQL microsecond ordering avoids skips between contact pages. */
export interface HumanContactPageAfter {
  readonly updatedAt: string;
  readonly userId: string;
}
export interface HumanContactPage {
  readonly contacts: readonly HumanContactRequest[];
  readonly next: HumanContactPageAfter | null;
}
export interface HumanContactRepository {
  /** Query is an exact normalized public handle. Missing, blocked and hidden users are indistinguishable. */
  lookup(input: { readonly tenantId: string; readonly viewerId: string; readonly handle: string }): Promise<HumanContact | null>;
  getOwnPreferences(input: { readonly tenantId: string; readonly userId: string }): Promise<HumanContactPreferences>;
  setOwnPreferences(input: { readonly tenantId: string; readonly userId: string; readonly policy?: HumanContactPolicy; readonly discoverableByHandle?: boolean }): Promise<HumanContactPreferences>;
  /** All admission checks and mutation must be atomic on the database side. */
  request(input: { readonly tenantId: string; readonly requesterId: string; readonly handle: string }): Promise<"accepted" | "pending" | "existing" | "unavailable">;
  respond(input: { readonly tenantId: string; readonly recipientId: string; readonly requesterId: string; readonly requestRevision: string; readonly accept: boolean }): Promise<boolean>;
  /** Optional additive cursor paging; previous list remains stable for older APKs. */
  listPage?(input: { readonly tenantId: string; readonly userId: string; readonly limit: number; readonly after: HumanContactPageAfter | null }): Promise<HumanContactPage>;
  list(input: { readonly tenantId: string; readonly userId: string; readonly limit: number }): Promise<readonly HumanContactRequest[]>;
  /** Either participant may revoke a contact; preserve an audit tombstone. */
  revoke(input: { readonly tenantId: string; readonly actorId: string; readonly otherUserId: string }): Promise<boolean>;
}


