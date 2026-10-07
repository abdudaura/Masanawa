import {
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type Instant,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export type CryptoChatActionKind = "convert" | "withdraw";
export type CryptoChatActionState = "pending" | "executing" | "completed";

export interface CryptoChatActionScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
}

export interface CryptoChatAction extends CryptoChatActionScope {
  readonly requestId: RequestId;
  readonly kind: CryptoChatActionKind;
  readonly providerCode: string;
  readonly targetProviderCode: string | null;
  readonly amount: string;
  readonly destinationAddress: string | null;
  readonly quoteSummary: string;
  readonly state: CryptoChatActionState;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly updatedAt: Instant;
}

export interface CryptoChatActionRepository {
  put(action: CryptoChatAction): Promise<void>;
  readCurrent(scope: CryptoChatActionScope, at: Instant): Promise<CryptoChatAction | null>;
  claim(scope: CryptoChatActionScope, requestId: RequestId, at: Instant): Promise<CryptoChatAction | null>;
  complete(scope: CryptoChatActionScope, requestId: RequestId, at: Instant): Promise<void>;
}

function code(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(normalized)) {
    throw new TypeError("crypto.chat.provider_code_invalid");
  }
  return normalized;
}

export function normalizeCryptoChatAction(
  input: CryptoChatAction,
): CryptoChatAction {
  const amount = input.amount.trim();
  const summary = input.quoteSummary.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(amount) || Number(amount) <= 0) {
    throw new TypeError("crypto.chat.amount_invalid");
  }
  if (!summary || summary.length > 1200) {
    throw new TypeError("crypto.chat.quote_invalid");
  }
  const createdAt = toInstant(input.createdAt);
  const expiresAt = toInstant(input.expiresAt);
  const updatedAt = toInstant(input.updatedAt);
  if (expiresAt <= createdAt || updatedAt < createdAt) {
    throw new TypeError("crypto.chat.lifecycle_invalid");
  }
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    requestId: parseCanonicalId("request", input.requestId),
    kind: input.kind,
    providerCode: code(input.providerCode),
    targetProviderCode:
      input.targetProviderCode === null ? null : code(input.targetProviderCode),
    amount,
    destinationAddress:
      input.destinationAddress === null
        ? null
        : input.destinationAddress.trim().slice(0, 512),
    quoteSummary: summary,
    state: input.state,
    createdAt,
    expiresAt,
    updatedAt,
  });
}
