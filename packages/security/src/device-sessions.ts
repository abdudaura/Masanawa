/** C09 contracts, reusing security.platform_sessions as the sole authentication truth. */
export interface FanDeviceSession {
  readonly id: string;
  readonly startedAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}
export interface FanDevicePrincipal {
  readonly tenantId: string;
  readonly fanUserId: string;
}
export type FanDeviceRevokeResult = "revoked" | "already" | "not_found" | "current" | "unauthorized";
export interface FanDeviceSessionStore {
  list(principal: FanDevicePrincipal, currentAccessHash: string): Promise<readonly FanDeviceSession[] | null>;
  revoke(principal: FanDevicePrincipal, currentAccessHash: string,
    deviceId: string, idempotencyKey: string): Promise<FanDeviceRevokeResult>;
}
export function validDeviceId(id: unknown): id is string {
  return typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id);
}
export function validDeviceRevokeKey(key: unknown): key is string {
  return typeof key === "string" && /^[A-Za-z0-9_-]{8,128}$/u.test(key);
}
