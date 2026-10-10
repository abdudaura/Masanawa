export type TalkActivityFilter = "all" | "talks" | "money" | "social";

export const talkActivityKinds = [
  "talk_invitation",
  "raise_hand_accepted",
  "raise_hand_declined",
  "ai_seat_sponsored",
  "ai_seat_accepted",
  "ai_seat_declined",
  "follow",
  "gift",
  "twin_hired",
  "earning",
  "replay_milestone",
  "platform",
] as const;

export type TalkActivityKind = (typeof talkActivityKinds)[number];

export interface TalkActivityRecord {
  readonly tenantId: string;
  readonly activityId: string;
  readonly userId: string;
  readonly kind: TalkActivityKind;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: string;
  readonly talkId: string | null;
  readonly profilePublicId: string | null;
  readonly personaId: string | null;
  readonly transactionId: string | null;
  readonly amountLabel: string | null;
  readonly requiresAction: boolean;
  readonly actionLabel: string | null;
  readonly unread: boolean;
}

export interface TalkActivityItem {
  readonly id: string;
  readonly kind: TalkActivityKind;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: string;
  readonly talkId?: string;
  readonly profilePublicId?: string;
  readonly personaId?: string;
  readonly transactionId?: string;
  readonly amountLabel?: string;
  readonly requiresAction: boolean;
  readonly actionLabel?: string;
  readonly unread: boolean;
}

export interface TalkActivityRepository {
  markRead(input: Readonly<{
    tenantId: string;
    userId: string;
    activityId: string;
  }>): Promise<boolean>;
  list(input: Readonly<{
    tenantId: string;
    userId: string;
    filter: TalkActivityFilter;
    limit: number;
  }>): Promise<readonly TalkActivityRecord[]>;
  append(input: Readonly<{
    tenantId: string;
    activityId: string;
    userId: string;
    kind: TalkActivityKind;
    title: string;
    detail: string;
    createdAt: string;
    talkId?: string;
    profilePublicId?: string;
    personaId?: string;
    transactionId?: string;
    amountLabel?: string;
    requiresAction?: boolean;
    actionLabel?: string;
    unread?: boolean;
  }>): Promise<TalkActivityRecord>;
}

export function activityCategory(kind: TalkActivityKind): Exclude<TalkActivityFilter, "all"> | "platform" {
  switch (kind) {
    case "talk_invitation":
    case "raise_hand_accepted":
    case "raise_hand_declined":
    case "ai_seat_sponsored":
    case "ai_seat_accepted":
    case "ai_seat_declined":
    case "replay_milestone":
      return "talks";
    case "gift":
    case "twin_hired":
    case "earning":
      return "money";
    case "follow":
      return "social";
    case "platform":
      return "platform";
  }
}

export function toTalkActivityItem(record: TalkActivityRecord): TalkActivityItem {
  return Object.freeze({
    id: record.activityId,
    kind: record.kind,
    title: record.title,
    detail: record.detail,
    createdAt: record.createdAt,
    ...(record.talkId === null ? {} : { talkId: record.talkId }),
    ...(record.profilePublicId === null ? {} : { profilePublicId: record.profilePublicId }),
    ...(record.personaId === null ? {} : { personaId: record.personaId }),
    ...(record.transactionId === null ? {} : { transactionId: record.transactionId }),
    ...(record.amountLabel === null ? {} : { amountLabel: record.amountLabel }),
    requiresAction: record.requiresAction,
    ...(record.actionLabel === null ? {} : { actionLabel: record.actionLabel }),
    unread: record.unread,
  });
}
