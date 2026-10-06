import { toInstant, type CharacterId, type Instant, type TenantId, type UserId } from "@masanawa/contracts";

export const groupRoomParticipantKinds = ["human", "character", "twin"] as const;
export type GroupRoomParticipantKind = (typeof groupRoomParticipantKinds)[number];

export const groupRoomParticipantRoles = ["owner", "moderator", "member"] as const;
export type GroupRoomParticipantRole = (typeof groupRoomParticipantRoles)[number];

export interface GroupRoomParticipant {
  readonly participantId: string;
  readonly kind: GroupRoomParticipantKind;
  readonly role: GroupRoomParticipantRole;
  readonly displayName: string;
  readonly bindingRef: string;
  readonly userId: UserId | null;
  readonly characterId: CharacterId | null;
}

export interface GroupRoom {
  readonly tenantId: TenantId;
  readonly roomId: string;
  readonly title: string;
  readonly description: string;
  readonly revision: number;
  readonly memoryScope: "group-room";
  readonly membershipRequired: true;
  readonly privateRelationshipMemoryEligible: false;
  readonly participants: readonly GroupRoomParticipant[];
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface GroupRoomMessage {
  readonly tenantId: TenantId;
  readonly roomId: string;
  readonly messageId: string;
  readonly requestKey: string;
  readonly authorParticipantId: string;
  readonly text: string;
  readonly createdAt: Instant;
}

export interface CreateGroupRoomInput {
  readonly tenantId: TenantId;
  readonly roomId: string;
  readonly title: string;
  readonly description: string;
  readonly participants: readonly GroupRoomParticipant[];
  readonly createdAt: Instant;
}

export interface ReplaceGroupRoomParticipantsInput {
  readonly tenantId: TenantId;
  readonly roomId: string;
  readonly expectedRevision: number;
  readonly participants: readonly GroupRoomParticipant[];
  readonly updatedAt: Instant;
}

export interface AppendGroupRoomMessageInput {
  readonly tenantId: TenantId;
  readonly roomId: string;
  readonly messageId: string;
  readonly requestKey: string;
  readonly authorParticipantId: string;
  readonly text: string;
  readonly createdAt: Instant;
}

export interface GroupRoomRepository {
  create(input: CreateGroupRoomInput): Promise<GroupRoom>;
  read(input: { readonly tenantId: TenantId; readonly roomId: string }): Promise<GroupRoom | null>;
  replaceParticipants(input: ReplaceGroupRoomParticipantsInput): Promise<GroupRoom>;
  appendMessage(input: AppendGroupRoomMessageInput): Promise<{
    readonly outcome: "stored" | "replay";
    readonly message: GroupRoomMessage;
  }>;
  listMessages(input: {
    readonly tenantId: TenantId;
    readonly roomId: string;
    readonly limit: number;
  }): Promise<readonly GroupRoomMessage[]>;
}

function bounded(value: string, name: string, max: number, allowEmpty = false): string {
  const normalized = value.trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function oneOf<T extends readonly string[]>(value: string, allowed: T, name: string): T[number] {
  if (!allowed.includes(value as T[number])) {
    throw new TypeError(`${name} is invalid`);
  }
  return value as T[number];
}

function normalizeParticipant(input: GroupRoomParticipant): GroupRoomParticipant {
  const kind = oneOf(input.kind, groupRoomParticipantKinds, "group participant kind");
  const role = oneOf(input.role, groupRoomParticipantRoles, "group participant role");
  const participantId = bounded(input.participantId, "group participant id", 160);
  const bindingRef = bounded(input.bindingRef, "group participant bindingRef", 512);
  const displayName = bounded(input.displayName, "group participant displayName", 200);

  if (kind === "human") {
    if (input.userId === null || input.characterId !== null) {
      throw new TypeError("human group participant must bind exactly one User");
    }
  } else if (kind === "character") {
    if (input.characterId === null || input.userId !== null) {
      throw new TypeError("character group participant must bind exactly one Character");
    }
  } else if (input.characterId === null || input.userId === null) {
    throw new TypeError("twin group participant must bind owner User and Character");
  }

  return Object.freeze({
    participantId,
    kind,
    role,
    displayName,
    bindingRef,
    userId: input.userId,
    characterId: input.characterId,
  });
}

export function normalizeGroupRoom(input: GroupRoom): GroupRoom {
  const participants = input.participants.map(normalizeParticipant);
  if (participants.length < 2 || participants.length > 128) {
    throw new TypeError("Group Room requires 2..128 participants");
  }
  const ids = participants.map((participant) => participant.participantId);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError("Group Room participant IDs must be unique");
  }
  if (participants.filter((participant) => participant.role === "owner").length !== 1) {
    throw new TypeError("Group Room requires exactly one owner");
  }
  if (
    input.memoryScope !== "group-room" ||
    input.membershipRequired !== true ||
    input.privateRelationshipMemoryEligible !== false
  ) {
    throw new TypeError("Group Room privacy boundary is invalid");
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new TypeError("Group Room revision is invalid");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    roomId: bounded(input.roomId, "group room id", 160),
    title: bounded(input.title, "group room title", 200),
    description: bounded(input.description, "group room description", 4000, true),
    revision: input.revision,
    memoryScope: "group-room" as const,
    membershipRequired: true as const,
    privateRelationshipMemoryEligible: false as const,
    participants: Object.freeze(participants),
    createdAt: toInstant(input.createdAt),
    updatedAt: toInstant(input.updatedAt),
  });
}

export function createGroupRoom(input: CreateGroupRoomInput): GroupRoom {
  return normalizeGroupRoom({
    tenantId: input.tenantId,
    roomId: input.roomId,
    title: input.title,
    description: input.description,
    revision: 0,
    memoryScope: "group-room",
    membershipRequired: true,
    privateRelationshipMemoryEligible: false,
    participants: input.participants,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function normalizeGroupRoomMessage(
  input: GroupRoomMessage,
  room: GroupRoom,
): GroupRoomMessage {
  if (input.tenantId !== room.tenantId || input.roomId !== room.roomId) {
    throw new TypeError("Group Room message scope mismatch");
  }
  if (!room.participants.some((participant) => participant.participantId === input.authorParticipantId)) {
    throw new TypeError("Group Room message author is not a member");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    roomId: input.roomId,
    messageId: bounded(input.messageId, "group message id", 160),
    requestKey: bounded(input.requestKey, "group message requestKey", 200),
    authorParticipantId: bounded(input.authorParticipantId, "group message author", 160),
    text: bounded(input.text, "group message text", 24_000),
    createdAt: toInstant(input.createdAt),
  });
}

export class InMemoryGroupRoomRepository implements GroupRoomRepository {
  readonly #rooms = new Map<string, GroupRoom>();
  readonly #messages = new Map<string, GroupRoomMessage[]>();
  readonly #requests = new Map<string, GroupRoomMessage>();

  async create(input: CreateGroupRoomInput): Promise<GroupRoom> {
    const room = createGroupRoom(input);
    const key = this.#roomKey(room.tenantId, room.roomId);
    const existing = this.#rooms.get(key);
    if (existing !== undefined) {
      if (JSON.stringify(existing) === JSON.stringify(room)) return existing;
      throw new TypeError("Group Room identity already exists with different content");
    }
    this.#rooms.set(key, room);
    this.#messages.set(key, []);
    return room;
  }

  async read(input: { readonly tenantId: TenantId; readonly roomId: string }): Promise<GroupRoom | null> {
    return this.#rooms.get(this.#roomKey(input.tenantId, bounded(input.roomId, "group room id", 160))) ?? null;
  }

  async replaceParticipants(input: ReplaceGroupRoomParticipantsInput): Promise<GroupRoom> {
    const key = this.#roomKey(
      input.tenantId,
      bounded(input.roomId, "group room id", 160),
    );
    const current = this.#rooms.get(key);
    if (current === undefined) {
      throw new TypeError("Group Room does not exist");
    }
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new TypeError("Group Room expected revision is invalid");
    }
    if (current.revision !== input.expectedRevision) {
      throw new TypeError("Group Room membership revision is stale");
    }
    const updated = normalizeGroupRoom({
      ...current,
      participants: input.participants,
      revision: current.revision + 1,
      updatedAt: toInstant(input.updatedAt),
    });
    this.#rooms.set(key, updated);
    return updated;
  }

  async appendMessage(input: AppendGroupRoomMessageInput): Promise<{
    readonly outcome: "stored" | "replay";
    readonly message: GroupRoomMessage;
  }> {
    const room = await this.read({ tenantId: input.tenantId, roomId: input.roomId });
    if (room === null) throw new TypeError("Group Room does not exist");

    const message = normalizeGroupRoomMessage({
      tenantId: input.tenantId,
      roomId: input.roomId,
      messageId: input.messageId,
      requestKey: input.requestKey,
      authorParticipantId: input.authorParticipantId,
      text: input.text,
      createdAt: input.createdAt,
    }, room);

    const requestIdentity =
      `${input.tenantId}\0${message.roomId}\0${message.requestKey}`;
    const prior = this.#requests.get(requestIdentity);
    if (prior !== undefined) {
      if (JSON.stringify(prior) !== JSON.stringify(message)) {
        throw new TypeError("Group Room message request replay changed payload");
      }
      return Object.freeze({ outcome: "replay" as const, message: prior });
    }

    const roomKey = this.#roomKey(input.tenantId, input.roomId);
    const messages = this.#messages.get(roomKey);
    if (messages === undefined) throw new TypeError("Group Room message store is unavailable");
    if (messages.some((entry) => entry.messageId === message.messageId)) {
      throw new TypeError("Group Room messageId already exists");
    }
    messages.push(message);
    this.#requests.set(requestIdentity, message);
    return Object.freeze({ outcome: "stored" as const, message });
  }

  async listMessages(input: {
    readonly tenantId: TenantId;
    readonly roomId: string;
    readonly limit: number;
  }): Promise<readonly GroupRoomMessage[]> {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 500) {
      throw new TypeError("Group Room message limit is invalid");
    }
    const key = this.#roomKey(input.tenantId, bounded(input.roomId, "group room id", 160));
    const room = this.#rooms.get(key);
    if (room === undefined) return Object.freeze([]);
    const messages = this.#messages.get(key) ?? [];
    return Object.freeze(messages.slice(-input.limit));
  }

  #roomKey(tenantId: TenantId, roomId: string): string {
    return `${tenantId}\0${roomId}`;
  }
}
