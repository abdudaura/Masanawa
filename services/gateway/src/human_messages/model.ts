/** C02 human messages — canonical account identities; never AI chat sessions. */
export interface HumanMessage {
  readonly conversationId: string;
  readonly messageId: string;
  readonly senderUserId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly deletedAt: string | null;
  readonly revision: number;
}
export interface HumanConversation {
  readonly conversationId: string;
  readonly otherUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastMessage: HumanMessage | null;
}
export interface HumanMessagePage {
  readonly messages: readonly HumanMessage[];
  /** Opaque exclusive pagination cursor; never use a client-generated timestamp as authority. */
  readonly nextCursor: string | null;
}
export interface HumanMessageRepository {
  start(input: {tenantId: string; userId: string; recipientUserId: string; proposedId: string}): Promise<HumanConversation | null>;
  list(input: {tenantId: string; userId: string; limit: number}): Promise<readonly HumanConversation[]>;
  read(input: {tenantId: string; userId: string; conversationId: string}): Promise<HumanConversation | null>;
  history(input: {tenantId: string; userId: string; conversationId: string; limit: number; before: {at: string; id: string} | null}): Promise<HumanMessagePage | null>;
  send(input: {tenantId: string; userId: string; conversationId: string; clientRequestId: string; messageId: string; text: string; digest: string}): Promise<HumanMessage | null>;
  edit(input: {tenantId: string; userId: string; conversationId: string; messageId: string; text: string; expectedRevision: number}): Promise<HumanMessage | null>;
  remove(input: {tenantId: string; userId: string; conversationId: string; messageId: string; expectedRevision: number}): Promise<HumanMessage | null>;
}
