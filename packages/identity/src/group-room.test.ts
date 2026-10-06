import { describe, expect, it } from "vitest";
import type { CharacterId, TenantId, UserId } from "@masanawa/contracts";
import {
  InMemoryGroupRoomRepository,
  createGroupRoom,
  normalizeGroupRoom,
  type GroupRoomParticipant,
} from "./group-room.js";

const tenantId = "tenant:00000000-0000-4000-8000-000000000001" as TenantId;
const ownerUserId = "user:00000000-0000-4000-8000-000000000001" as UserId;
const secondUserId = "user:00000000-0000-4000-8000-000000000002" as UserId;
const gwaniId = "character:00000000-0000-4000-8000-000000000001" as CharacterId;
const twinId = "character:00000000-0000-4000-8000-000000000002" as CharacterId;

function participants(): readonly GroupRoomParticipant[] {
  return [
    {
      participantId: "member-owner",
      kind: "human",
      role: "owner",
      displayName: "Owner",
      bindingRef: "subject:user:opaque",
      userId: ownerUserId,
      characterId: null,
    },
    {
      participantId: "member-gwani",
      kind: "character",
      role: "member",
      displayName: "Gwani",
      bindingRef: "presentation:character:gwani",
      userId: null,
      characterId: gwaniId,
    },
    {
      participantId: "member-twin",
      kind: "twin",
      role: "member",
      displayName: "Twin",
      bindingRef: "presentation:twin:opaque",
      userId: secondUserId,
      characterId: twinId,
    },
  ] as const;
}

describe("Group Room identity boundary", () => {
  it("creates group-only privacy with explicit mixed membership", () => {
    const room = createGroupRoom({
      tenantId,
      roomId: "group-room-1",
      title: "Study Group",
      description: "",
      participants: participants(),
      createdAt: "2026-10-06T10:00:00.000Z",
    });

    expect(room.memoryScope).toBe("group-room");
    expect(room.membershipRequired).toBe(true);
    expect(room.privateRelationshipMemoryEligible).toBe(false);
    expect(room.participants).toHaveLength(3);
  });

  it("rejects zero/multiple owners and private Relationship memory", () => {
    const base = createGroupRoom({
      tenantId,
      roomId: "group-room-1",
      title: "Study Group",
      description: "",
      participants: participants(),
      createdAt: "2026-10-06T10:00:00.000Z",
    });

    expect(() =>
      normalizeGroupRoom({
        ...base,
        participants: base.participants.map((participant) => ({
          ...participant,
          role: "member" as const,
        })),
      }),
    ).toThrow(/exactly one owner/u);

    expect(() =>
      normalizeGroupRoom({
        ...base,
        privateRelationshipMemoryEligible: true as false,
      }),
    ).toThrow(/privacy boundary/u);
  });

  it("requires exact canonical binding shapes for human Character and Twin members", () => {
    const broken = [...participants()];
    broken[1] = {
      ...broken[1]!,
      userId: ownerUserId,
    };
    expect(() =>
      createGroupRoom({
        tenantId,
        roomId: "group-room-1",
        title: "Study Group",
        description: "",
        participants: broken,
        createdAt: "2026-10-06T10:00:00.000Z",
      }),
    ).toThrow(/Character/u);
  });
});

describe("Group Room message custody", () => {
  it("admits member messages and exact request replay once", async () => {
    const repository = new InMemoryGroupRoomRepository();
    await repository.create({
      tenantId,
      roomId: "group-room-1",
      title: "Study Group",
      description: "",
      participants: participants(),
      createdAt: "2026-10-06T10:00:00.000Z",
    });

    const input = {
      tenantId,
      roomId: "group-room-1",
      messageId: "message-1",
      requestKey: "request-1",
      authorParticipantId: "member-gwani",
      text: "Which topic should we revise?",
      createdAt: "2026-10-06T10:01:00.000Z",
    } as const;

    await expect(repository.appendMessage(input)).resolves.toMatchObject({
      outcome: "stored",
    });
    await expect(repository.appendMessage(input)).resolves.toMatchObject({
      outcome: "replay",
    });
    await expect(repository.listMessages({ tenantId, roomId: "group-room-1", limit: 10 }))
      .resolves.toHaveLength(1);
  });

  it("rejects non-member authors and changed request replay", async () => {
    const repository = new InMemoryGroupRoomRepository();
    await repository.create({
      tenantId,
      roomId: "group-room-1",
      title: "Study Group",
      description: "",
      participants: participants(),
      createdAt: "2026-10-06T10:00:00.000Z",
    });

    await expect(repository.appendMessage({
      tenantId,
      roomId: "group-room-1",
      messageId: "message-1",
      requestKey: "request-non-member",
      authorParticipantId: "outsider",
      text: "Injected",
      createdAt: "2026-10-06T10:01:00.000Z",
    })).rejects.toThrow(/not a member/u);

    await repository.appendMessage({
      tenantId,
      roomId: "group-room-1",
      messageId: "message-2",
      requestKey: "request-2",
      authorParticipantId: "member-owner",
      text: "First",
      createdAt: "2026-10-06T10:02:00.000Z",
    });
    await expect(repository.appendMessage({
      tenantId,
      roomId: "group-room-1",
      messageId: "message-3",
      requestKey: "request-2",
      authorParticipantId: "member-owner",
      text: "Changed",
      createdAt: "2026-10-06T10:03:00.000Z",
    })).rejects.toThrow(/changed payload/u);
  });

  it("isolates room reads by Tenant", async () => {
    const repository = new InMemoryGroupRoomRepository();
    await repository.create({
      tenantId,
      roomId: "group-room-1",
      title: "Study Group",
      description: "",
      participants: participants(),
      createdAt: "2026-10-06T10:00:00.000Z",
    });

    const otherTenant =
      "tenant:00000000-0000-4000-8000-000000000099" as TenantId;
    await expect(repository.read({ tenantId: otherTenant, roomId: "group-room-1" }))
      .resolves.toBeNull();
  });
});
