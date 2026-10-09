import { describe, expect, it, vi } from "vitest";
import { createReplayInsightService, ReplayInsightError } from "./service.js";
import type {
  ReplayInsightDraft, ReplayInsightRepository, ReplayInsightSource, ReplayInsightView,
} from "./model.js";

const source: ReplayInsightSource = {
  tenantId: "tenant-a", talkId: "talk_1", recordingId: "recording_1",
  checksumSha256: "a".repeat(64), replayRevision: 4,
};
const ready: ReplayInsightView = {
  talkId: "talk_1", recordingId: "recording_1", status: "ready",
  summary: "Host review", highlights: ["One highlight"],
  nextTalkTitle: "Next Talk", updatedAt: "2026-10-09T00:00:00.000Z",
};
function fixtures() {
  let eligible: ReplayInsightSource | null = source;
  let current: ReplayInsightView | null = null;
  const repository: ReplayInsightRepository = {
    source: vi.fn(async (tenantId, userId, talkId) =>
      tenantId === "tenant-a" && userId === "host" && talkId === "talk_1" ? eligible : null),
    claim: vi.fn(async () => current === null),
    read: vi.fn(async () => eligible ? current : null),
    complete: vi.fn(async () => { current = ready; return !!eligible; }),
    fail: vi.fn(async () => { current = {
      ...ready, status: "failed", summary: null, highlights: [], nextTalkTitle: null,
    }; }),
  };
  const processor = { generate: vi.fn(async (): Promise<ReplayInsightDraft> => ({
    summary: "Host review", highlights: ["One highlight"], nextTalkTitle: "Next Talk",
  })) };
  const service = createReplayInsightService({
    repository, processor,
    authorizer: { async authorize({authorizationHeader}) {
      if (authorizationHeader === "Bearer host") return { tenantId: "tenant-a", userId: "host" };
      if (authorizationHeader === "Bearer outsider") return { tenantId: "tenant-a", userId: "outsider" };
      if (authorizationHeader === "Bearer other-tenant") return { tenantId: "tenant-b", userId: "host" };
      throw new ReplayInsightError("unauthorized",401);
    } },
  });
  return { repository, processor, service, revoke() { eligible = null; }, setReady() { current = ready; } };
}
const request = { authorizationHeader: "Bearer host", talkId: "talk_1", processingConsent: true as const };
describe("U16 explicit host-only recorded-media insights", () => {
  it("refuses all guests and cross-tenant or missing replay without invoking providers", async () => {
    const f = fixtures();
    await expect(f.service.request({...request, authorizationHeader: "Bearer outsider"}))
      .rejects.toMatchObject({statusCode:404});
    await expect(f.service.request({...request, authorizationHeader: "Bearer other-tenant"}))
      .rejects.toMatchObject({statusCode:404});
    f.revoke();
    await expect(f.service.request(request)).rejects.toMatchObject({statusCode:404});
    expect(f.processor.generate).not.toHaveBeenCalled();
  });
  it("requires explicit analysis consent, not old recording or publication consent", async () => {
    const f = fixtures();
    await expect(f.service.request({ ...request, processingConsent: false as never }))
      .rejects.toMatchObject({code:"talks.insights.consent_required"});
    expect(f.repository.claim).not.toHaveBeenCalled();
  });
  it("publishes no model action: result remains a private Host draft", async () => {
    const f = fixtures();
    expect(await f.service.request(request)).toEqual(ready);
    expect(f.repository.complete).toHaveBeenCalledOnce();
    expect(f.processor.generate).toHaveBeenCalledOnce();
    expect(await f.service.request(request)).toEqual(ready);
    expect(f.processor.generate).toHaveBeenCalledOnce();
  });
  it("fails closed on an invalid or excessively long generation", async () => {
    const f = fixtures();
    f.processor.generate.mockResolvedValueOnce({
      summary:"x".repeat(2500),highlights:[],nextTalkTitle:"Fake",
    });
    await expect(f.service.request(request))
      .rejects.toMatchObject({code:"talks.insights.generation_failed"});
    expect(f.repository.complete).not.toHaveBeenCalled();
    expect(f.repository.fail).toHaveBeenCalledOnce();
  });
  it("fences a replay revoked while generation is in progress", async () => {
    const f = fixtures();
    f.processor.generate.mockImplementationOnce(async () => {
      f.revoke();
      return {summary:"Private",highlights:[],nextTalkTitle:null};
    });
    await expect(f.service.request(request))
      .rejects.toMatchObject({code:"talks.insights.source_changed",statusCode:409});
    expect(f.repository.fail).toHaveBeenCalledOnce();
  });
  it("does not expose provider failures or raw transcript content", async () => {
    const f = fixtures();
    f.processor.generate.mockRejectedValueOnce(new Error("raw user conversation SECRET"));
    await expect(f.service.request(request))
      .rejects.toMatchObject({code:"talks.insights.generation_failed",message:"talks.insights.generation_failed"});
  });
});
