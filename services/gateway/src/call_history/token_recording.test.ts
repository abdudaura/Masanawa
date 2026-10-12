import { describe, expect, it, vi } from "vitest";
import { createGeminiLiveTokenService } from "../live_voice_token.js";

const characterId = "character_0199a000-0000-7000-8000-000000000001";
function setup(ok = true) {
  const recordIssued = vi.fn(async () => "0199a000-0000-7000-8000-000000000002");
  const authorize = vi.fn(async () => ({ scope: { tenantId: "tenant-a", userId: "user-a" } }));
  const readForCharacter = vi.fn(async (): Promise<{ voiceProvider: string; voiceName: string } | null> => ({ voiceProvider: "gemini", voiceName: "Kore" }));
  const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify({ name: "ephemeral-test-token-value" }), { status: ok ? 200 : 503 }));
  const service = createGeminiLiveTokenService({
    apiKey: "fake-test-key",
    authorizer: { authorize } as never,
    platformProfiles: { readForCharacter } as never,
    fetchImpl: fetchImpl as never,
    callHistory: { recordIssued },
  });
  return { service, recordIssued, authorize, readForCharacter, fetchImpl };
}
describe("server-issued call history", () => {
  it("rejects unauthorized issuance before provider execution or storage", async () => {
    const { service, recordIssued, authorize, fetchImpl } = setup();
    authorize.mockRejectedValue(new Error("unauthorized"));
    await expect(service.mint({ characterId, authorizationHeader: undefined })).rejects.toThrow("unauthorized");
    expect(recordIssued).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects non-platform personas before provider execution", async () => {
    const { service, recordIssued, readForCharacter, fetchImpl } = setup();
    readForCharacter.mockResolvedValue(null);
    await expect(service.mint({ characterId, authorizationHeader: undefined })).rejects.toMatchObject({ statusCode: 403 });
    expect(recordIssued).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("returns the persisted call ID after authorized token issuance", async () => {
    const { service, recordIssued } = setup();
    const result = await service.mint({ characterId, authorizationHeader: "Bearer account" });
    expect(result.callId).toBe("0199a000-0000-7000-8000-000000000002");
    expect(recordIssued).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a", characterId, expiresAt: result.expiresAt });
  });
  it("does not record a successful call attempt when provider provisioning fails", async () => {
    const { service, recordIssued } = setup(false);
    await expect(service.mint({ characterId, authorizationHeader: undefined })).rejects.toThrow("provisioning failed");
    expect(recordIssued).not.toHaveBeenCalled();
  });
  it("does not return credentials if persistence fails", async () => {
    const { service, recordIssued } = setup();
    recordIssued.mockRejectedValue(new Error("storage unavailable"));
    await expect(service.mint({ characterId, authorizationHeader: undefined })).rejects.toThrow("storage unavailable");
  });
  it("bounds provider credential issuance with an abort signal", async () => {
    const { service, fetchImpl } = setup();
    await service.mint({ characterId, authorizationHeader: "Bearer account" });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

});
