/** C01 human-only contact discovery. No PersonaId or public Talk membership. */
export type HumanContactPolicy = "anyone" | "requests" | "nobody";
export type HumanContactStatus = "none" | "incoming" | "outgoing" | "accepted" | "declined";

export interface HumanContact {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  /** Subject's policy is private: expose action eligibility instead, never preference metadata. */
  readonly canMessage: boolean;
  readonly status: HumanContactStatus;
}
export interface HumanContactRequest {
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly status: Exclude<HumanContactStatus, "none">;
  readonly updatedAt: string;
}
export interface HumanContactRepository {
  /** Query is an exact normalized public handle. Missing, blocked and hidden users are indistinguishable. */
  lookup(input: { readonly tenantId: string; readonly viewerId: string; readonly handle: string }): Promise<HumanContact | null>;
  getOwnPolicy(input: { readonly tenantId: string; readonly userId: string }): Promise<HumanContactPolicy>;
  setOwnPolicy(input: { readonly tenantId: string; readonly userId: string; readonly policy: HumanContactPolicy }): Promise<HumanContactPolicy>;
  /** All admission checks and mutation must be atomic on the database side. */
  request(input: { readonly tenantId: string; readonly requesterId: string; readonly handle: string }): Promise<"accepted" | "pending" | "existing" | "unavailable">;
  respond(input: { readonly tenantId: string; readonly recipientId: string; readonly requesterId: string; readonly accept: boolean }): Promise<boolean>;
  list(input: { readonly tenantId: string; readonly userId: string; readonly limit: number }): Promise<readonly HumanContactRequest[]>;
}
