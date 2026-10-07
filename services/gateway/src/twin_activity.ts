import type { CharacterId, TenantId, UserId } from "@masanawa/contracts";
import type { PersonalCloneProvisioningRepository } from "@masanawa/identity";
export type TwinActivityKind =
  | "visit"
  | "conversation"
  | "purchase"
  | "gift"
  | "voice"
  | "owner-request"
  | "earning";

export type TwinActivityStatus =
  | "observed"
  | "pending"
  | "completed"
  | "refunded"
  | "expired"
  | "failed";

export interface TwinActivityRecord {
  readonly eventId: string;
  readonly referenceId: string;
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly kind: TwinActivityKind;
  readonly status: TwinActivityStatus;
  readonly occurredAt: string;
  readonly amountCredits?: number | null;
}

export interface TwinActivityAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface TwinActivityAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "creator.activity.read";
  }): Promise<TwinActivityAuthority>;
}

export interface TwinActivitySource {
  listForTwin(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly limit: number;
  }): Promise<readonly TwinActivityRecord[]>;
}

export interface TwinActivityItem {
  readonly eventId: string;
  readonly referenceId: string | null;
  readonly kind: TwinActivityKind;
  readonly status: TwinActivityStatus;
  readonly occurredAt: string;
  readonly amountCredits: number | null;
  readonly title: string;
  readonly detail: string;
}

export interface TwinActivitySummary {
  readonly visitors: number;
  readonly conversations: number;
  readonly earningsCredits: number;
  readonly pendingOwnerRequests: number;
}

export interface TwinActivityView {
  readonly hasTwin: boolean;
  readonly characterId: string | null;
  readonly summary: TwinActivitySummary;
  readonly items: readonly TwinActivityItem[];
}

export interface TwinActivityService {
  read(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<TwinActivityView>;
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new RangeError("Activity limit must be between 1 and 100");
  }
  return value;
}

function safeAmount(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError("Activity amount is invalid");
  }
  return value;
}

function presentation(record: TwinActivityRecord): Pick<TwinActivityItem, "title" | "detail"> {
  switch (record.kind) {
    case "visit":
      return { title: "New twin visit", detail: "Someone opened your twin." };
    case "conversation":
      return { title: "Twin conversation", detail: "Someone chatted with your twin." };
    case "purchase":
      return {
        title: record.status === "refunded" ? "Purchase refunded" : "Purchase through your twin",
        detail: record.status === "completed"
          ? "A Masanawa purchase was completed through your twin."
          : "A purchase linked to your twin changed status.",
      };
    case "gift":
      return {
        title: record.status === "refunded" ? "Gift returned" : "Gift received",
        detail: record.status === "completed"
          ? "Someone blessed you through your twin."
          : "A gift linked to your twin changed status.",
      };
    case "voice":
      return {
        title: record.status === "refunded" ? "Voice charge refunded" : "Paid twin voice",
        detail: record.status === "completed"
          ? "A paid voice session with your twin completed."
          : "A paid voice session changed status.",
      };
    case "owner-request":
      return {
        title: "Talk-to-owner request",
        detail: record.status === "pending"
          ? "Someone requested a paid conversation with you."
          : "A paid owner conversation request changed status.",
      };
    case "earning":
      return {
        title: record.status === "refunded" ? "Earning reversed" : "Earning settled",
        detail: record.status === "completed"
          ? "Earnings from your twin were settled."
          : "An earning linked to your twin changed status.",
      };
  }
}

function emptyView(): TwinActivityView {
  return Object.freeze({
    hasTwin: false,
    characterId: null,
    summary: Object.freeze({
      visitors: 0,
      conversations: 0,
      earningsCredits: 0,
      pendingOwnerRequests: 0,
    }),
    items: Object.freeze([]),
  });
}

export function createTwinActivityService(input: {
  readonly authorizer: TwinActivityAuthorizer;
  readonly personalClones: PersonalCloneProvisioningRepository;
  readonly source: TwinActivitySource;
}): TwinActivityService {
  return Object.freeze<TwinActivityService>({
    async read(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "creator.activity.read",
      });
      const clone = await input.personalClones.readPersonalClone({
        tenantId: authority.tenantId,
        userId: authority.userId,
      });
      if (!clone) return emptyView();

      const records = await input.source.listForTwin({
        tenantId: authority.tenantId,
        characterId: clone.characterId,
        limit: boundedLimit(request.limit),
      });

      const ordered = [...records].sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt),
      );
      let visitors = 0;
      let conversations = 0;
      let earningsCredits = 0;
      let pendingOwnerRequests = 0;
      const seenOwnerRequests = new Set<string>();
      const items: TwinActivityItem[] = [];

      for (const record of ordered) {
        if (record.tenantId !== authority.tenantId || record.characterId !== clone.characterId) {
          throw new Error("Twin activity source returned an out-of-scope record");
        }
        const amountCredits = safeAmount(record.amountCredits);
        if (record.kind === "visit" && record.status !== "failed") visitors += 1;
        if (record.kind === "conversation" && record.status !== "failed") conversations += 1;
        if (
          record.kind === "owner-request" &&
          !seenOwnerRequests.has(record.referenceId)
        ) {
          seenOwnerRequests.add(record.referenceId);
          if (record.status === "pending") pendingOwnerRequests += 1;
        }
        if (record.kind === "earning" && record.status === "completed" && amountCredits !== null) {
          earningsCredits += amountCredits;
        }
        const copy = presentation(record);
        items.push(Object.freeze({
          eventId: record.eventId,
          referenceId: record.kind === "owner-request" ? record.referenceId : null,
          kind: record.kind,
          status: record.status,
          occurredAt: record.occurredAt,
          amountCredits,
          ...copy,
        }));
      }

      items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      return Object.freeze({
        hasTwin: true,
        characterId: clone.characterId,
        summary: Object.freeze({ visitors, conversations, earningsCredits, pendingOwnerRequests }),
        items: Object.freeze(items),
      });
    },
  });
}
