import type { CreatorEconomyService, CreatorEconomySnapshot } from "../creator_economy.js";
import type { TwinActivityService, TwinActivityView, TwinActivityItem } from "../twin_activity.js";

/** Only authoritative commerce balances are earnings. Activity is a bounded sample. */
export interface TwinQualityView {
  readonly schemaVersion: 1;
  readonly hasTwin: boolean;
  readonly characterId: string | null;
  readonly earnings: {
    readonly pendingCredits: number;
    readonly availableCredits: number;
    readonly source: "commerce-ledger";
    readonly payoutGuaranteed: false;
  };
  readonly float: {
    readonly remainingCredits: number;
    readonly exhausted: boolean;
    readonly taskQuotaRemaining: null;
    readonly providerCostCredits: null;
    readonly unknownMetricsReason: "no-authoritative-cost-or-quota-reader";
  };
  readonly evidence: {
    readonly characterId: string;
    readonly completed: number;
    readonly unsuccessful: number;
    readonly observedConversations: number;
    readonly sampledEvents: number;
    readonly sampledLimit: number;
    readonly totalResultsKnown: false;
  } | null;
  readonly recent: readonly {
    readonly eventId: string;
    readonly kind: TwinActivityItem["kind"];
    readonly status: TwinActivityItem["status"];
    readonly occurredAt: string;
    readonly referenceId: string | null;
    readonly amountCredits: number | null;
  }[];
  readonly qualification: "ledger-balances-with-sampled-activity";
}

export interface TwinQualityService {
  read(input: { readonly authorizationHeader: string | undefined; readonly limit?: number }): Promise<TwinQualityView>;
}
function nonnegative(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new TypeError("Invalid authoritative " + field);
  }
  return value;
}
function pageLimit(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new RangeError("Twin quality limit must be 1..100");
  }
  return value;
}
const kinds = new Set(["visit", "conversation", "purchase", "gift", "voice", "owner-request", "earning"]);
const statuses = new Set(["observed", "pending", "completed", "refunded", "expired", "failed"]);

function validateEconomy(value: CreatorEconomySnapshot): void {
  for (const field of ["customerCredits","agentFloatCredits","pendingEarningsCredits","availableEarningsCredits"] as const) {
    nonnegative(value[field], field);
  }
  if (typeof value.hasClone !== "boolean" ||
      (value.hasClone && (typeof value.characterId !== "string" || !value.characterId)) ||
      (!value.hasClone && (value.characterId !== null || value.agentFloatCredits !== 0 ||
       value.pendingEarningsCredits !== 0 || value.availableEarningsCredits !== 0))) {
    throw new Error("Inconsistent canonical creator economy");
  }
}
function qualifyActivity(view: TwinActivityView, limit: number): Pick<TwinQualityView,"evidence"|"recent"> {
  if (!view.hasTwin || !view.characterId || !Array.isArray(view.items) || view.items.length > limit) {
    throw new Error("Inconsistent Twin activity page");
  }
  const seen = new Map<string,string>();
  const rows: Array<TwinQualityView["recent"][number]> = [];
  let completed = 0, unsuccessful = 0, observedConversations = 0;
  for (const item of view.items) {
    if (typeof item.eventId !== "string" || !item.eventId || item.eventId.length > 256 ||
        !kinds.has(item.kind) || !statuses.has(item.status) ||
        !Number.isFinite(Date.parse(item.occurredAt)) ||
        (item.referenceId !== null && (typeof item.referenceId !== "string" || item.referenceId.length > 256)) ||
        (item.amountCredits !== null && !Number.isSafeInteger(item.amountCredits))) {
      throw new Error("Unqualified Twin activity evidence");
    }
    const amount = item.amountCredits === null ? null : nonnegative(item.amountCredits,"activity amount");
    const fingerprint = JSON.stringify([item.kind,item.status,item.occurredAt,item.referenceId,amount]);
    const previous = seen.get(item.eventId);
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error("Conflicting repeated Twin event ID");
      continue;
    }
    seen.set(item.eventId,fingerprint);
    if (["conversation","purchase","voice","owner-request"].includes(item.kind)) {
      if (item.status === "completed") completed++;
      if (["refunded","expired","failed"].includes(item.status)) unsuccessful++;
    }
    if (item.kind === "conversation" && item.status !== "failed") observedConversations++;
    rows.push(Object.freeze({
      eventId: item.eventId,
      kind: item.kind,
      status: item.status,
      occurredAt: item.occurredAt,
      referenceId: item.kind === "owner-request" ? item.referenceId : null,
      amountCredits: amount,
    }));
  }
  rows.sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
  return Object.freeze({
    evidence: Object.freeze({
      characterId: view.characterId, completed, unsuccessful, observedConversations,
      sampledEvents: rows.length, sampledLimit: limit, totalResultsKnown: false as const,
    }),
    recent: Object.freeze(rows),
  });
}

/** Both upstream services authenticate the SAME bearer and scope Twin by server identity. */
export function createTwinQualityService(input: {
  readonly economy: Pick<CreatorEconomyService,"read">;
  readonly activity: Pick<TwinActivityService,"read">;
}): TwinQualityService {
  return Object.freeze({
    async read(request) {
      const limit = pageLimit(request.limit);
      const [economy,activity] = await Promise.all([
        input.economy.read({ authorizationHeader: request.authorizationHeader }),
        input.activity.read({ authorizationHeader: request.authorizationHeader, limit }),
      ]);
      validateEconomy(economy);
      if (economy.hasClone !== activity.hasTwin || economy.characterId !== activity.characterId) {
        throw new Error("Canonical Twin identity mismatch");
      }
      if (!economy.hasClone && (activity.items.length > 0 || activity.summary.earningsCredits !== 0)) {
        throw new Error("Unexpected activity for absent Twin");
      }
      const qualified = economy.hasClone ? qualifyActivity(activity,limit) : null;
      return Object.freeze({
        schemaVersion: 1 as const,
        hasTwin: economy.hasClone, characterId: economy.characterId,
        earnings: Object.freeze({
          pendingCredits: economy.pendingEarningsCredits,
          availableCredits: economy.availableEarningsCredits,
          source: "commerce-ledger" as const,
          payoutGuaranteed: false as const,
        }),
        float: Object.freeze({
          remainingCredits: economy.agentFloatCredits,
          exhausted: economy.hasClone && economy.agentFloatCredits === 0,
          taskQuotaRemaining: null,
          providerCostCredits: null,
          unknownMetricsReason: "no-authoritative-cost-or-quota-reader" as const,
        }),
        evidence: qualified?.evidence ?? null,
        recent: qualified?.recent ?? Object.freeze([]),
        qualification: "ledger-balances-with-sampled-activity" as const,
      });
    },
  });
}
