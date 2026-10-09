/** C02 private person↔person messaging. Sequence values are decimal strings (Postgres bigint). */
export interface HumanDmMessage {
  readonly messageId: string;
  readonly conversationId: string;
  readonly sequence: string;
  readonly senderUserId: string;
  readonly clientRequestId: string;
  readonly body: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly deletedAt: string | null;
}
export interface HumanDmConversation {
  readonly conversationId: string;
  readonly otherUserId: string;
  readonly otherDisplayName: string;
  readonly otherAvatarUrl: string | null;
  readonly otherHandle: string | null;
  readonly lastReadSequence: string;
  readonly lastSequence: string;
  readonly preview: string | null;
  readonly updatedAt: string;
  readonly unreadCount: number;
}
export interface HumanDmRepository {
  open(input: { tenantId: string; userId: string; otherUserId: string }): Promise<string | null>;
  inbox(input: { tenantId: string; userId: string; limit: number; before?: string }): Promise<readonly HumanDmConversation[]>;
  history(input: { tenantId: string; userId: string; conversationId: string; limit: number; before?: string }): Promise<readonly HumanDmMessage[] | null>;
  send(input: { tenantId: string; userId: string; conversationId: string; clientRequestId: string; body: string; sha256: string }): Promise<HumanDmMessage | "forbidden" | "conflict" | "rate_limited">;
  edit(input: { tenantId: string; userId: string; messageId: string; body: string }): Promise<HumanDmMessage | null>;
  remove(input: { tenantId: string; userId: string; messageId: string }): Promise<HumanDmMessage | null>;
  read(input: { tenantId: string; userId: string; conversationId: string; throughSequence: string }): Promise<string | null>;
}
