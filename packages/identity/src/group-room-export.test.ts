import { describe, expect, it } from "vitest";
import type { TenantId, UserId } from "@masanawa/contracts";
import {
  InMemoryGroupRoomRepository,
  createGroupRoom,
  type GroupRoomRepository,
} from "./index.js";

const tenantId =
  "tenant:00000000-0000-4000-8000-000000000001" as TenantId;
const ownerUserId =
  "user:00000000-0000-4000-8000-000000000001" as UserId;
const memberUserId =
  "user:00000000-0000-4000-8000-000000000002" as UserId;

describe("Group Room public Identity export", () => {
  it("exposes the canonical Group Room contract through @masanawa/identity", async () => {
    const repository: GroupRoomRepository = new InMemoryGroupRoomRepository();
    const room = createGroupRoom({
      tenantId,
      roomId: "group-room-export",
      title: "Launch Study Group",
      description: "",
      participants: [
        {
          participantId: "owner",
          kind: "human",
          role: "owner",
          displayName: "Owner",
          bindingRef: "subject:user:owner",
          userId: ownerUserId,
          characterId: null,
        },
        {
          participantId: "member",
          kind: "human",
          role: "member",
          displayName: "Member",
          bindingRef: "subject:user:member",
          userId: memberUserId,
          characterId: null,
        },
      ],
      createdAt: "2026-10-06T10:00:00.000Z",
    });

    await expect(repository.create({
      tenantId: room.tenantId,
      roomId: room.roomId,
      title: room.title,
      description: room.description,
      participants: room.participants,
      createdAt: room.createdAt,
    })).resolves.toMatchObject({
      roomId: "group-room-export",
      memoryScope: "group-room",
      privateRelationshipMemoryEligible: false,
    });
  });
});
