/** L-ADMIN / J19. Composed only by AF00 after R1 staff-role authority is available. */
export type StaffRole = "viewer" | "content_editor" | "moderator" | "finance_operator" | "ops_admin" | "super_admin";
export type OperationsFlag = "posting" | "teaching" | "imports" | "calls" | "paid_joins";
export const FLAG_NAMES: readonly OperationsFlag[] = ["posting","teaching","imports","calls","paid_joins"] as const;
export interface StaffPrincipal {
  readonly tenantId: string;
  readonly userId: string;
  readonly roles: readonly StaffRole[];
  /** Enforced by the canonical session authorizer, never from request body. */
  readonly mfaVerified: boolean;
}
export interface OperationsAuthorizer {
  resolve(authorizationHeader: string | undefined): Promise<StaffPrincipal>;
}
export interface FlagSnapshot {
  readonly name: OperationsFlag;
  readonly enabled: boolean;
  readonly revision: number;
  readonly updatedAt: string | null;
}
export interface FlagMutation {
  readonly name: OperationsFlag;
  readonly enabled: boolean;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly reason: string;
}
export interface AuditRecord {
  readonly eventId: string;
  readonly action: string;
  readonly actorId: string;
  readonly at: string;
  readonly subject: string;
}
export interface OperationsRepository {
  listFlags(tenantId: string): Promise<readonly FlagSnapshot[]>;
  setFlag(input: FlagMutation & { tenantId: string; actorId: string }): Promise<FlagSnapshot>;
  audit(tenantId: string, limit: number): Promise<readonly AuditRecord[]>;
}
export interface StaffSummary { readonly userId: string; readonly roles: readonly StaffRole[]; readonly mfaVerified: boolean; }
export interface StaffDirectory {
  list(tenantId: string): Promise<readonly StaffSummary[]>;
  /** Staff grants are always handled by the canonical R1 authority, never this module. */
}
export class OperationsError extends Error {
  constructor(readonly code: "unauthorized" | "forbidden" | "invalid" | "conflict" | "unavailable", readonly status: number) {super(code);}
}
export interface OperationsService {
  flags(auth: string | undefined): Promise<readonly FlagSnapshot[]>;
  preview(auth: string | undefined, name: OperationsFlag, enabled: boolean): Promise<{ current: FlagSnapshot; proposed: boolean; requiresReleaseApproval: boolean }>;
  setFlag(auth: string | undefined, change: FlagMutation): Promise<FlagSnapshot>;
  audit(auth: string | undefined, limit?: number): Promise<readonly AuditRecord[]>;
  staff(auth: string | undefined): Promise<readonly StaffSummary[]>;
}
function has(principal: StaffPrincipal, role: StaffRole): boolean {
  return principal.roles.includes("super_admin") || principal.roles.includes(role);
}
function requirePrincipal(p: StaffPrincipal, role: StaffRole, mfa = false): StaffPrincipal {
  if (!p.tenantId || !p.userId || !has(p,role)) throw new OperationsError("forbidden",403);
  if (mfa && !p.mfaVerified) throw new OperationsError("forbidden",403);
  return p;
}
function validFlag(name: string): name is OperationsFlag {return FLAG_NAMES.some(value=>value===name);}
function verifiedMutation(change: FlagMutation): void {
  if (!validFlag(change.name) || typeof change.enabled !== "boolean" ||
      !Number.isSafeInteger(change.expectedRevision) || change.expectedRevision < 0 ||
      !/^[a-zA-Z0-9._:-]{8,128}$/u.test(change.idempotencyKey) ||
      change.reason.trim().length < 12 || change.reason.length > 500) {
    throw new OperationsError("invalid",400);
  }
}
export function createOperationsService(deps: {
  authorizer: OperationsAuthorizer;
  repo: OperationsRepository;
  staff?: StaffDirectory;
  /** False unless AF00 confirms rollback, release, staff review and provider permissions. */
  allowEnable?: (principal: StaffPrincipal, flag: OperationsFlag) => Promise<boolean>;
}): OperationsService {
  return {
    async flags(auth) {
      const p=requirePrincipal(await deps.authorizer.resolve(auth),"ops_admin");
      return deps.repo.listFlags(p.tenantId);
    },
    async preview(auth,name,enabled) {
      const p=requirePrincipal(await deps.authorizer.resolve(auth),"ops_admin",true);
      if (!validFlag(name) || typeof enabled!=="boolean") throw new OperationsError("invalid",400);
      const current=(await deps.repo.listFlags(p.tenantId)).find(x=>x.name===name);
      if (!current) throw new OperationsError("unavailable",503);
      return {current,proposed:enabled,requiresReleaseApproval:enabled};
    },
    async setFlag(auth,change) {
      const p=requirePrincipal(await deps.authorizer.resolve(auth),"ops_admin",true);
      verifiedMutation(change);
      // Default-off activation guard prevents enabling provider-backed products by code merge.
      if (change.enabled && !(await deps.allowEnable?.(p,change.name))) throw new OperationsError("forbidden",403);
      try {
        return await deps.repo.setFlag({...change,tenantId:p.tenantId,actorId:p.userId});
      } catch (error) {
        // Adapter independence: avoid importing Gateway errors into PostgreSQL's tsconfig.
        if (error instanceof Error && error.message === "admin_ops.conflict") throw new OperationsError("conflict",409);
        if (error instanceof Error && error.message === "admin_ops.unavailable") throw new OperationsError("unavailable",503);
        throw error;
      }
    },
    async audit(auth,limit=30) {
      const p=requirePrincipal(await deps.authorizer.resolve(auth),"super_admin",true);
      if (!Number.isSafeInteger(limit) || limit<1 || limit>100) throw new OperationsError("invalid",400);
      return deps.repo.audit(p.tenantId,limit);
    },
    async staff(auth) {
      const p=requirePrincipal(await deps.authorizer.resolve(auth),"super_admin",true);
      if (!deps.staff) throw new OperationsError("unavailable",503);
      return deps.staff.list(p.tenantId);
    }
  };
}
