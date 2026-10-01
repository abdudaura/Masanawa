import type {
  Instant,
  OperationId,
  TenantId,
} from "@masanawa/contracts";
import { PlatformError } from "@masanawa/contracts";

export interface IdempotencyRecord {
  readonly tenantId: TenantId;
  readonly operationKind: string;
  readonly idempotencyKey: string;
  readonly authorityScopeHash: string;
  readonly requestFingerprint: string;
  readonly operationId: OperationId;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly expiresAt: Instant;
}

export function assertIdempotencyMatch(
  record: Pick<IdempotencyRecord, "requestFingerprint">,
  requestFingerprint: string,
): void {
  if (record.requestFingerprint !== requestFingerprint) {
    throw new PlatformError({
      code: "idempotency.fingerprint_conflict",
      category: "conflict",
      message: "Idempotency key is already bound to a different canonical request",
      retryable: false,
    });
  }
}
