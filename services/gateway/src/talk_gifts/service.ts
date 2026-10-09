import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  TalkGiftActivitySink,
  TalkGiftCatalog,
  TalkGiftCatalogItem,
  TalkGiftCatalogSource,
  TalkGiftExecutor,
  TalkGiftReceipt,
  TalkGiftRepository,
} from "./model.js";

export interface TalkGiftAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkGiftError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkGiftError";
  }
}

export interface TalkGiftService {
  catalog(input: Readonly<{ authorizationHeader: string | undefined; talkId: string }>): Promise<TalkGiftCatalog>;
  gift(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    requestId: string;
    amountCredits: number;
    catalogItemId?: string;
  }>): Promise<TalkGiftReceipt>;
}

// Launch defaults live on the server, never in the client. Policy may inject
// a validated catalog without changing the HTTP contract.
export const defaultTalkGiftCatalog: readonly TalkGiftCatalogItem[] = Object.freeze(([
  { id: "applause", name: "Applause", visual: "applause", amountCredits: 50, available: true },
  { id: "heart", name: "Heart", visual: "heart", amountCredits: 100, available: true },
  { id: "flower", name: "Flower", visual: "flower", amountCredits: 150, available: true },
  { id: "spark", name: "Spark", visual: "spark", amountCredits: 250, available: true },
  { id: "crown", name: "Crown", visual: "crown", amountCredits: 500, available: true },
  { id: "celebration", name: "Celebration", visual: "celebration", amountCredits: 1000, available: true },
] satisfies TalkGiftCatalogItem[]).map(item => Object.freeze(item)));

function checkedCatalog(items: readonly TalkGiftCatalogItem[]): readonly TalkGiftCatalogItem[] {
  const ids = new Set<string>();
  const visuals = new Set(["applause", "heart", "flower", "spark", "crown", "celebration"]);
  if (items.length > 24) throw new Error("Invalid Talk gift catalog");
  return Object.freeze(items.map(item => {
    if (!/^[a-z][a-z0-9_-]{0,47}$/.test(item.id) || ids.has(item.id) ||
        !item.name.trim() || item.name.length > 80 ||
        !visuals.has(item.visual) || typeof item.available !== "boolean" ||
        !Number.isSafeInteger(item.amountCredits) ||
        item.amountCredits < 1 || item.amountCredits > 1_000_000_000_000) {
      throw new Error("Invalid Talk gift catalog item");
    }
    ids.add(item.id);
    return Object.freeze({ ...item, name: item.name.trim() });
  }));
}

function text(value: string, name: "talk_id" | "request_id" | "catalog_item_id", max = 256): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TalkGiftError(`talks.gift.${name}_invalid`, 400);
  }
  return normalized;
}

function amount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000_000) {
    throw new TalkGiftError("talks.gift.amount_invalid", 400);
  }
  return value;
}

export function createTalkGiftService(input: Readonly<{
  repository: TalkGiftRepository;
  authorizer: TalkGiftAuthorizer;
  executor: TalkGiftExecutor;
  activity?: TalkGiftActivitySink;
  catalog?: readonly TalkGiftCatalogItem[];
  catalogSource?: TalkGiftCatalogSource;
}>): TalkGiftService {
  const fallbackCatalog = checkedCatalog(input.catalog ?? defaultTalkGiftCatalog);
  async function catalogFor(tenantId: string, talkId: string) {
    const source = input.catalogSource;
    if (!source) return fallbackCatalog;
    return checkedCatalog(await source.load({ tenantId, talkId }));
  }
  async function authorizedTarget(authorizationHeader: string | undefined, rawTalkId: string) {
    const viewer = await input.authorizer.authorize({ authorizationHeader });
    const talkId = text(rawTalkId, "talk_id", 160);
    const target = await input.repository.resolveTarget({ tenantId: viewer.tenantId, talkId, senderUserId: viewer.userId });
    if (!target) throw new TalkGiftError("talks.not_found", 404);
    if (target.hostUserId === viewer.userId) {
      throw new TalkGiftError("talks.gift.self_forbidden", 409);
    }
    return { viewer, talkId, target };
  }
  return Object.freeze<TalkGiftService>({
    async catalog(request) {
      const { viewer, talkId } = await authorizedTarget(
        request.authorizationHeader, request.talkId,
      );
      const items = await catalogFor(viewer.tenantId, talkId);
      return Object.freeze({ talkId, currency: "Credits" as const, items });
    },
    async gift(request) {
      const { viewer, talkId, target } = await authorizedTarget(
        request.authorizationHeader, request.talkId,
      );
      const requestId = text(request.requestId, "request_id");
      const amountCredits = amount(request.amountCredits);
      const catalogItems = await catalogFor(viewer.tenantId, talkId);
      const catalogItemId = request.catalogItemId === undefined
        ? undefined
        : text(request.catalogItemId, "catalog_item_id", 48);
      // Legacy APKs send amounts without an option ID. Preserve their
      // protocol but never grant authority to arbitrary client-priced gifts.
      if (catalogItemId === undefined &&
          !catalogItems.some(item => item.available && item.amountCredits === amountCredits)) {
        throw new TalkGiftError("talks.gift.option_unavailable", 409);
      }
      if (catalogItemId !== undefined) {
        const item = catalogItems.find(option => option.id === catalogItemId);
        if (!item || !item.available) {
          throw new TalkGiftError("talks.gift.option_unavailable", 409);
        }
        if (item.amountCredits !== amountCredits) {
          // Never execute under changed/incorrect terms. Client must refresh
          // the server's authoritative prices and obtain fresh consent.
          throw new TalkGiftError("talks.gift.price_changed", 409);
        }
      }

      let moved;
      try {
        moved = await input.executor.execute({
          tenantId: viewer.tenantId,
          requestId,
          senderUserId: viewer.userId,
          recipientUserId: target.hostUserId,
          amountCredits,
        });
      } catch (error) {
        if (error instanceof Error && /balance|insufficient/iu.test(error.message)) {
          throw new TalkGiftError("talks.gift.insufficient_credits", 409);
        }
        throw error;
      }

      if (moved.amountCredits !== amountCredits) {
        throw new Error("Talk gift executor returned a mismatched amount");
      }

      if (!moved.replayed && input.activity) {
        try {
          await input.activity.append({
            tenantId: viewer.tenantId,
            requestId,
            recipientUserId: target.hostUserId,
            senderUserId: viewer.userId,
            talkId,
            talkTitle: target.talkTitle,
            giftId: moved.giftId,
            amountCredits,
            completedAt: moved.completedAt,
          });
        } catch {
          // Activity is a rebuildable projection. A completed canonical ledger
          // transfer must never be reported as failed because its feed receipt
          // could not be appended.
        }
      }

      return Object.freeze({
        giftId: moved.giftId,
        talkId,
        recipientUserId: target.hostUserId,
        recipientName: target.hostName,
        amountCredits,
        status: "completed" as const,
        ...(catalogItemId ? { catalogItemId } : {}),
        completedAt: moved.completedAt,
      });
    },
  });
}

