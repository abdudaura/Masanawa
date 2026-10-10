import { describe, expect, it, vi } from "vitest";
import { createTalkModerationService } from "../talk_moderation/service.js";
import type { TalkModerationRepository } from "../talk_moderation/model.js";
import type { TalkAiSeatHostBridge } from "./service.js";

function repository() {
  const actOnRequest = vi.fn(async () => ({
    controls: { requests: [], participants: [] },
    mediaActions: [],
  }));
  const repo: TalkModerationRepository = {
    async participation() { return { handStatus: "idle" }; },
    async setReaction() { return { handStatus: "idle" }; },
    async setRaised() { return { handStatus: "idle" }; },
    async leaveHumanSeat() { throw new Error("unexpected seat leave"); },
    async submitQuestion() { throw new Error("unexpected question submission"); },
    async listQuestions() { throw new Error("unexpected question listing"); },
    async resolveQuestion() { throw new Error("unexpected question resolution"); },
    async inviteHuman() { throw new Error("unexpected invitation"); },
    async respondHumanInvitation() { throw new Error("unexpected invitation response"); },
    async hostControls() {
      return {
        requests: [],
        participants: [{
          participantId: "host_user",
          displayName: "Host",
          kind: "human",
          isHost: true,
          isMuted: false,
        }],
      };
    },
    actOnRequest,
    async moderateParticipant() {
      return { controls: { requests: [], participants: [] }, mediaActions: [] };
    },
    async endTalk() { return { mediaActions: [] }; },
  };
  return { repo, actOnRequest };
}

function authorizer() {
  return {
    async authorize() {
      return {
        tenantId: "tenant_0199c1ae-0000-7000-8000-000000000001" as never,
        userId: "user_0199c1ae-0000-7000-8000-000000000002" as never,
        profile: {
          tenantId: "tenant_0199c1ae-0000-7000-8000-000000000001" as never,
          userId: "user_0199c1ae-0000-7000-8000-000000000002" as never,
          name: "Host",
          email: null,
          phone: null,
          locale: "en",
          createdAt: "2026-10-07T00:00:00.000Z",
        },
      };
    },
  };
}

describe("Talk moderation AI Seat bridge", () => {
  it("lets Commerce handle sponsored AI decisions without invoking the free human path", async () => {
    const { repo, actOnRequest } = repository();
    const decide = vi.fn(async () => ({ handled: true }));
    const aiSeats: TalkAiSeatHostBridge = {
      async sweep() {},
      decide,
    };
    const service = createTalkModerationService({
      repository: repo,
      authorizer: authorizer(),
      aiSeats,
    });

    const result = await service.hostRequest({
      authorizationHeader: "Bearer host",
      talkId: "talk_live_1",
      requestId: "request_ai_1",
      action: "accept",
    });

    expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      talkId: "talk_live_1",
      requestId: "request_ai_1",
      action: "accept",
    }));
    expect(actOnRequest).not.toHaveBeenCalled();
    expect(result.participants[0]).toMatchObject({ isHost: true });
  });

  it("preserves the existing free human Speaker moderation path", async () => {
    const { repo, actOnRequest } = repository();
    const aiSeats: TalkAiSeatHostBridge = {
      async sweep() {},
      async decide() { return { handled: false }; },
    };
    const service = createTalkModerationService({
      repository: repo,
      authorizer: authorizer(),
      aiSeats,
    });

    await service.hostRequest({
      authorizationHeader: "Bearer host",
      talkId: "talk_live_1",
      requestId: "hand_user_1",
      action: "accept",
    });

    expect(actOnRequest).toHaveBeenCalledTimes(1);
  });

  it("sweeps expired sponsored holds before showing Host controls", async () => {
    const { repo } = repository();
    const sweep = vi.fn(async () => undefined);
    const aiSeats: TalkAiSeatHostBridge = {
      sweep,
      async decide() { return { handled: false }; },
    };
    const service = createTalkModerationService({
      repository: repo,
      authorizer: authorizer(),
      aiSeats,
    });

    await service.hostControls({
      authorizationHeader: "Bearer host",
      talkId: "talk_live_1",
    });

    expect(sweep).toHaveBeenCalledWith(expect.objectContaining({
      talkId: "talk_live_1",
    }));
  });
});
