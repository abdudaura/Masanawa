export interface DmMessage {
  readonly conversationId: string;
  readonly messageId: string;
  readonly sequence: number;
  readonly clientMessageId: string;
  readonly senderUserId: string;
  readonly text: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly deletedAt: string | null;
}
export interface DmThread {
  readonly conversationId: string;
  readonly otherUserId: string;
  readonly otherHandle: string | null;
  readonly otherDisplayName: string;
  readonly lastSequence: number;
  readonly lastActivityAt: string;
  readonly lastReadSequence: number;
  readonly unreadCount: number;
}
export type DmScope = Readonly<{ tenantId: string; userId: string }>;
export interface HumanDmRepository {
  open(input: DmScope & Readonly<{ otherUserId: string }>): Promise<string | null>;
  list(input: DmScope & Readonly<{ limit: number; before?: string }>): Promise<readonly DmThread[]>;
  history(input: DmScope & Readonly<{ conversationId: string; limit: number; beforeSequence?: number }>): Promise<readonly DmMessage[] | null>;
  send(input: DmScope & Readonly<{ conversationId: string; clientMessageId: string; text: string }>): Promise<DmMessage | "unavailable" | "rate_limited" | "conflict">;
  read(input: DmScope & Readonly<{ conversationId: string; upToSequence: number }>): Promise<number | null>;
  edit(input: DmScope & Readonly<{ conversationId: string; messageId: string; text: string }>): Promise<DmMessage | null>;
  remove(input: DmScope & Readonly<{ conversationId: string; messageId: string }>): Promise<DmMessage | null>;
}
