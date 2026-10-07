export type WalletHistoryKind =
  | "funding"
  | "transfer-sent"
  | "transfer-received"
  | "purchase"
  | "commission"
  | "gift"
  | "voice"
  | "owner-session"
  | "refund"
  | "withdrawal";

export interface WalletHistoryRecord {
  readonly id: string;
  readonly kind: WalletHistoryKind;
  readonly title: string;
  readonly amountCredits: number;
  readonly incoming: boolean;
  readonly createdAt: string;
}

export interface WalletBalanceSnapshot {
  readonly spendableCredits: number;
  readonly pendingEarningsCredits: number;
  readonly availableEarningsCredits: number;
}

export interface WalletProjectionView extends WalletBalanceSnapshot {
  readonly entries: readonly WalletHistoryRecord[];
}

export interface WalletAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface WalletAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "wallet.read";
  }): Promise<WalletAuthority>;
}

export interface WalletBalanceSource {
  readBalances(input: {
    readonly tenantId: string;
    readonly userId: string;
  }): Promise<WalletBalanceSnapshot>;
}

export interface WalletHistorySource {
  listHistory(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly limit: number;
  }): Promise<readonly WalletHistoryRecord[]>;
}

export interface WalletProjectionService {
  read(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<WalletProjectionView>;
}

function safeCredits(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function safeLimit(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new RangeError("Wallet history limit must be between 1 and 100");
  }
  return value;
}

function normalizeEntry(record: WalletHistoryRecord): WalletHistoryRecord {
  const allowed: readonly WalletHistoryKind[] = [
    "funding",
    "transfer-sent",
    "transfer-received",
    "purchase",
    "commission",
    "gift",
    "voice",
    "owner-session",
    "refund",
    "withdrawal",
  ];
  if (!allowed.includes(record.kind)) {
    throw new TypeError("Unknown Wallet history kind");
  }
  if (!record.id || !record.title) {
    throw new TypeError("Wallet history identity/title is invalid");
  }
  if (Number.isNaN(new Date(record.createdAt).getTime())) {
    throw new TypeError("Wallet history timestamp is invalid");
  }
  return Object.freeze({
    id: record.id,
    kind: record.kind,
    title: record.title,
    amountCredits: safeCredits(record.amountCredits, "amountCredits"),
    incoming: record.incoming === true,
    createdAt: new Date(record.createdAt).toISOString(),
  });
}

export function createWalletProjectionService(input: {
  readonly authorizer: WalletAuthorizer;
  readonly balances: WalletBalanceSource;
  readonly history: WalletHistorySource;
}): WalletProjectionService {
  return Object.freeze<WalletProjectionService>({
    async read(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "wallet.read",
      });
      const [balances, history] = await Promise.all([
        input.balances.readBalances({
          tenantId: authority.tenantId,
          userId: authority.userId,
        }),
        input.history.listHistory({
          tenantId: authority.tenantId,
          userId: authority.userId,
          limit: safeLimit(request.limit),
        }),
      ]);

      const entries = history.map(normalizeEntry).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      );

      return Object.freeze({
        spendableCredits: safeCredits(
          balances.spendableCredits,
          "spendableCredits",
        ),
        pendingEarningsCredits: safeCredits(
          balances.pendingEarningsCredits,
          "pendingEarningsCredits",
        ),
        availableEarningsCredits: safeCredits(
          balances.availableEarningsCredits,
          "availableEarningsCredits",
        ),
        entries: Object.freeze(entries),
      });
    },
  });
}
