import { describe, expect, it, vi } from "vitest";
import {
  createLiveStageCopilot,
  LiveStageCopilotError,
  type CopilotTurnOutcome,
} from "./copilot.js";
import type { TalkAuthorizedStage } from "../talk_ai_worker/event_context.js";
import type { TalkAiSeatWorkerResult } from "../talk_ai_worker/worker.js";

const at = "2026-10-09T00:30:00.000Z";
const stage: TalkAuthorizedStage = {
  tenantId: "tenant-A", talkId: "talk-A", topic: "Education",
  hostName: "Host", participants: [
    { kind: "human", displayName: "Host", isHost: true },
    { kind: "expert", displayName: "Expert", isHost: false },
  ],
  events: [
    {
      tenantId: "tenant-A", talkId: "talk-A", eventId: "question-public",
      kind: "question", visibility: "public", actorName: "Viewer",
      action: "approved", body: "Why does education matter?",
      occurredAt: "2026-10-09T00:29:00Z",
    },
    {
      tenantId: "tenant-A", talkId: "talk-A", eventId: "comment-private",
      kind: "comment", visibility: "private", actorName: "Viewer",
      body: "Account number 111122223333", occurredAt: "2026-10-09T00:29:00Z",
    },
    {
      tenantId: "tenant-A", talkId: "talk-A", eventId: "poll-public",
      kind: "poll", visibility: "public", actorName: "Host",
      action: "opened", question: "Learning methods?",
      occurredAt: "2026-10-09T00:29:01Z",
    },
  ],
};
const admitted = {
  tenantId: "tenant-A", talkId: "talk-A", seatId: "seat-A",
  personaId: "persona-A", kind: "expert" as const,
  admitted: true, muted: false, removed: false,
  commercialAuthorizationActive: true,
};
const live = {
  state: "live" as const,
  hostConnected: true, aiGenerationAllowed: true,
};
const published: TalkAiSeatWorkerResult = {
  disposition: "published", reason: "published",
};
const request = {
  authorizationHeader: "Bearer genuine-session",
  talkId: "talk-A", seatId: "seat-A", requestId: "user-action-1",
  hostApprovedTranscript: "Please answer the Host's question.",
};
function setup(opts: Readonly<{
  canHost?: boolean;
  live?: { state: "live" | "reconnecting" | "ended"; hostConnected: boolean; aiGenerationAllowed: boolean };
  seat?: typeof admitted;
  stage?: TalkAuthorizedStage | null;
  workerResult?: TalkAiSeatWorkerResult;
  failWorker?: boolean;
  claimResult?: "budget_exhausted" | "conflict" | "in_progress";
}> = {}) {
  const auth = {
    authorize: vi.fn(async () => ({ tenantId: "tenant-A", userId: "host-A" })),
    isCurrentHost: vi.fn(async () => opts.canHost ?? true),
  };
  const seats = {
    readLiveState: vi.fn(async () => opts.live ?? live),
    readSeat: vi.fn(async () => opts.seat ?? admitted),
  };
  const events = {
    readAuthorizedStage: vi.fn(async () =>
      opts.stage === undefined ? stage : opts.stage),
  };
  const worker = {
    handleTurn: vi.fn(async () => {
      if (opts.failWorker) throw new Error("publish connection lost");
      return opts.workerResult ?? published;
    }),
    stop: vi.fn(),
  };
  const stored = new Map<string, Readonly<{ text: string; outcome: CopilotTurnOutcome | "running" }>>();
  const turns = {
    acquire: vi.fn(async (input: { requestId: string; transcript: string }) => {
      if (opts.claimResult) return { kind: opts.claimResult } as const;
      const previous = stored.get(input.requestId);
      if (previous) {
        if (previous.text !== input.transcript) return { kind: "conflict" } as const;
        if (previous.outcome === "running") return { kind: "in_progress" } as const;
        return { kind: "replay", outcome: previous.outcome } as const;
      }
      stored.set(input.requestId, { text: input.transcript, outcome: "running" });
      return { kind: "acquired" } as const;
    }),
    finish: vi.fn(async (input: {
      requestId: string; transcript: string; outcome: CopilotTurnOutcome;
    }) => {
      stored.set(input.requestId, { text: input.transcript, outcome: input.outcome });
    }),
  };
  const copilot = createLiveStageCopilot({
    authorizer: auth, seats, stage: events, worker, turns,
    maxHostApprovedTurnsPerHour: 4, now: () => new Date(at),
  });
  return { copilot, auth, seats, events, worker, turns, stored };
}
describe("U15 live Host copilot admission and safety", () => {
  it("displays only bounded approved public questions and polls, not private comments", async () => {
    const { copilot, events, worker } = setup();
    const result = await copilot.suggestions({
      authorizationHeader: request.authorizationHeader, talkId: request.talkId,
    });
    expect(result.map(item => item.kind)).toEqual(["poll", "question"]);
    expect(result.every(item => item.trust === "public-untrusted-data")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Account number");
    expect(events.readAuthorizedStage).toHaveBeenCalledWith({
      tenantId: "tenant-A", talkId: "talk-A", before: at,
    });
    expect(worker.handleTurn).not.toHaveBeenCalled();
  });

  it("fails closed for wrong Host, never reading private stage events", async () => {
    const { copilot, events, turns, worker } = setup({ canHost: false });
    await expect(copilot.suggestions({
      authorizationHeader: request.authorizationHeader, talkId: "talk-A",
    })).rejects.toMatchObject({ code: "talks.host_forbidden", statusCode: 403 });
    await expect(copilot.approveTurn(request)).rejects.toBeInstanceOf(LiveStageCopilotError);
    expect(events.readAuthorizedStage).not.toHaveBeenCalled();
    expect(turns.acquire).not.toHaveBeenCalled();
    expect(worker.handleTurn).not.toHaveBeenCalled();
  });

  it("requires a currently connected Host, not a reconnecting/public AI stage", async () => {
    const { copilot, worker, turns } = setup({
      live: { ...live, state: "reconnecting", hostConnected: false },
    });
    await expect(copilot.approveTurn(request)).rejects.toMatchObject({
      code: "talks.stage_not_live", statusCode: 409,
    });
    expect(turns.acquire).not.toHaveBeenCalled();
    expect(worker.handleTurn).not.toHaveBeenCalled();
  });

  it("blocks unadmitted, muted, removed and commerce-revoked Seats before reserving cost", async () => {
    for (const seat of [
      { ...admitted, admitted: false },
      { ...admitted, muted: true },
      { ...admitted, removed: true },
      { ...admitted, commercialAuthorizationActive: false },
    ]) {
      const { copilot, turns, worker } = setup({ seat });
      expect(await copilot.approveTurn(request)).toEqual({
        status: "denied", reason: "seat_not_authorized",
      });
      expect(turns.acquire).not.toHaveBeenCalled();
      expect(worker.handleTurn).not.toHaveBeenCalled();
    }
  });

  it("dispatches an explicitly Host-approved speech turn through the canonical R02 worker", async () => {
    const { copilot, worker, turns } = setup();
    expect(await copilot.approveTurn(request)).toEqual({
      status: "published", reason: "published",
    });
    expect(worker.handleTurn).toHaveBeenCalledWith({
      tenantId: "tenant-A", talkId: "talk-A", seatId: "seat-A",
      turn: {
        transcript: request.hostApprovedTranscript, speakerUserId: "host-A", occurredAt: at,
      },
    });
    expect(turns.finish).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "published", requestId: "user-action-1",
    }));
  });

  it("deduplicates Host retries and rejects changed content for the same key", async () => {
    const { copilot, worker, turns } = setup();
    await copilot.approveTurn(request);
    expect(await copilot.approveTurn(request)).toEqual({
      status: "published", reason: "published",
    });
    expect(await copilot.approveTurn({
      ...request, hostApprovedTranscript: "Different unapproved turn",
    })).toEqual({ status: "conflict", reason: "claim_conflict" });
    expect(worker.handleTurn).toHaveBeenCalledTimes(1);
    expect(turns.finish).toHaveBeenCalledTimes(1);
  });

  it("never repeats an uncertain publication after worker timeout", async () => {
    const { copilot, worker, turns } = setup({ failWorker: true });
    expect(await copilot.approveTurn(request)).toEqual({
      status: "uncertain", reason: "worker_outcome_unknown",
    });
    expect(await copilot.approveTurn(request)).toEqual({
      status: "uncertain", reason: "previous_unknown",
    });
    expect(worker.handleTurn).toHaveBeenCalledTimes(1);
    expect(turns.finish).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "unknown",
    }));
  });

  it("blocks reserve failures and turn budgets without invoking inference", async () => {
    for (const kind of ["budget_exhausted", "conflict", "in_progress"] as const) {
      const { copilot, worker } = setup({ claimResult: kind });
      expect((await copilot.approveTurn(request)).status).toBe(kind);
      expect(worker.handleTurn).not.toHaveBeenCalled();
    }
  });

  it("makes no paid turn from polls, reactions or audience events alone", async () => {
    const { copilot, worker, turns } = setup();
    await copilot.suggestions({
      authorizationHeader: request.authorizationHeader, talkId: "talk-A",
    });
    expect(worker.handleTurn).not.toHaveBeenCalled();
    expect(turns.acquire).not.toHaveBeenCalled();
  });

  it("denies Host-approved attempts when the canonical worker observes late mute", async () => {
    const { copilot, turns } = setup({
      workerResult: { disposition: "aborted", reason: "state-changed-before-publish" },
    });
    expect(await copilot.approveTurn(request)).toEqual({
      status: "denied", reason: "state-changed-before-publish",
    });
    expect(turns.finish).toHaveBeenCalledWith(expect.objectContaining({ outcome: "denied" }));
  });

  it("rejects invalid user-controlled identifiers and overlong turns before any claim", async () => {
    const { copilot, turns } = setup();
    for (const changed of [
      { ...request, talkId: " \n" },
      { ...request, seatId: "a".repeat(161) },
      { ...request, requestId: "bad\nkey" },
      { ...request, hostApprovedTranscript: "x".repeat(501) },
    ]) {
      await expect(copilot.approveTurn(changed)).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(turns.acquire).not.toHaveBeenCalled();
  });

  it("hides absent or unauthorized stage instead of suggesting a made-up event", async () => {
    const { copilot, worker } = setup({ stage: null });
    await expect(copilot.suggestions({
      authorizationHeader: request.authorizationHeader, talkId: "talk-A",
    })).rejects.toMatchObject({ code: "talks.stage_unavailable" });
    expect(worker.handleTurn).not.toHaveBeenCalled();
  });
});
