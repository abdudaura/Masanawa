import { describe, it, expect, vi } from "vitest";
import { createGeminiLiveTokenService } from "../live_voice_token.js";
const characterId = "character_0199a000-0000-7000-8000-000000000001",
  callId = "0199a000-0000-7000-8000-000000000002";
function setup(withPaidVoice = true) {
  const recordIssued = vi.fn(async () => "outgoing");
  const attachIssued = vi.fn(async () => callId);
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ name: "ephemeral-test-token-value" }), {
        status: 200,
      }),
  );
  const validate = vi.fn(async () => {});
  const service = createGeminiLiveTokenService({
    apiKey: "fake-test-key",
    authorizer: {
      authorize: async () => ({ scope: { tenantId: "a", userId: "u" } }),
    } as never,
    platformProfiles: {
      readForCharacter: async () => ({
        voiceProvider: "gemini",
        voiceName: "Kore",
      }),
    } as never,
    callHistory: { recordIssued, attachIssued },
    fetchImpl: fetchImpl as never,
    ...(withPaidVoice
      ? { paidVoiceAdmission: { validate, tokenIssued: async () => {} } }
      : {}),
  });
  return { service, recordIssued, attachIssued, fetchImpl, validate };
}
describe("incoming media history and ambiguity", () => {
  it("denies incoming credentials if canonical paid admission is unavailable", async () => {
    const h = setup(false);
    await expect(
      h.service.mint({
        authorizationHeader: "Bearer account",
        characterId,
        historyCallId: callId,
        admissionId: "paid",
      }),
    ).rejects.toMatchObject({
      code: "calls.paid_admission_unavailable",
      statusCode: 403,
    });
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });
  it("preserves incoming identity without outgoing history", async () => {
    const h = setup();
    const result = await h.service.mint({
      authorizationHeader: "Bearer account",
      characterId,
      historyCallId: callId,
      admissionId: "paid",
    });
    expect(result.callId).toBe(callId);
    expect(h.recordIssued).not.toHaveBeenCalled();
    expect(h.attachIssued).toHaveBeenCalledWith(
      expect.objectContaining({
        callId,
        characterId,
        tenantId: "a",
        userId: "u",
      }),
    );
  });
  it("paid denial occurs before provider and remains retryable", async () => {
    const h = setup();
    h.validate.mockRejectedValue(new Error("paid denied"));
    await expect(
      h.service.mint({
        authorizationHeader: "Bearer account",
        characterId,
        historyCallId: callId,
        admissionId: "paid",
      }),
    ).rejects.toThrow("paid denied");
    expect(h.fetchImpl).not.toHaveBeenCalled();
    expect(h.attachIssued).not.toHaveBeenCalled();
  });
  it("classifies successful issuance then storage failure as unknown", async () => {
    const h = setup();
    h.attachIssued.mockRejectedValue(new Error("storage unavailable"));
    await expect(
      h.service.mint({
        authorizationHeader: "Bearer account",
        characterId,
        historyCallId: callId,
        admissionId: "paid",
      }),
    ).rejects.toMatchObject({ issuanceUnknown: true });
  });
  it("classifies network ambiguity as unknown and explicit rejection as retryable", async () => {
    const h = setup();
    h.fetchImpl.mockRejectedValue(new Error("network down"));
    await expect(
      h.service.mint({
        authorizationHeader: "Bearer account",
        characterId,
        historyCallId: callId,
        admissionId: "paid",
      }),
    ).rejects.toMatchObject({ issuanceUnknown: true });
    h.fetchImpl.mockResolvedValue(new Response("{}", { status: 503 }));
    const e = await h.service
      .mint({
        authorizationHeader: "Bearer account",
        characterId,
        historyCallId: callId,
        admissionId: "paid",
      })
      .catch((e) => e);
    expect(e.issuanceUnknown).toBeUndefined();
  });
});
