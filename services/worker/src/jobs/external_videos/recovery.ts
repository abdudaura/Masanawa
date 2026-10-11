/**
 * J15: optional provider-withdrawal handling using the existing review_audit
 * authority. The caller supplies a permission-checked official provider probe.
 * No scraping, playback download or auto-approval; this job is default OFF.
 */
export type Withdrawal = {
  tenantId: string; itemId: string; provider: "youtube"|"tiktok"|"facebook"; providerVideoId: string;
};
export type VerifiedWithdrawal = {
  provider: Withdrawal["provider"]; providerVideoId: string;
  status: "officially_removed"; evidenceReference: string;
};
export interface VideoWithdrawalDeps {
  enabled: boolean;
  verifyOfficialWithdrawal: (item: Withdrawal) => Promise<VerifiedWithdrawal | null>;
  reviewStore: {
    review(input: {tenantId:string; id:string; actorId:string; expectedState:"approved";
      state:"unavailable"; verificationReference:null; reasonReference:string;}): Promise<{reviewState:string}|null>;
  };
}
export async function applyVerifiedVideoWithdrawal(input: Withdrawal, deps: VideoWithdrawalDeps): Promise<"disabled"|"ignored"|"unavailable"> {
  if (!deps.enabled) return "disabled";
  if (!input.tenantId || !/^[a-f0-9-]{36}$/iu.test(input.itemId) ||
      !input.providerVideoId || !["youtube","tiktok","facebook"].includes(input.provider)) return "ignored";
  // Provider signal must be obtained from an authenticated official API adapter,
  // with permission and capability rechecked for this exact provider ID.
  const fact = await deps.verifyOfficialWithdrawal(input);
  if (!fact || fact.status !== "officially_removed" || fact.provider !== input.provider ||
      fact.providerVideoId !== input.providerVideoId || !/^.{12,250}$/us.test(fact.evidenceReference)) return "ignored";
  const updated = await deps.reviewStore.review({
    tenantId:input.tenantId,id:input.itemId,actorId:"system:external-video-review",
    expectedState:"approved",state:"unavailable",verificationReference:null,reasonReference:fact.evidenceReference,
  });
  // CAS no-op protects against duplicate provider events and staff transitions.
  return updated?.reviewState === "unavailable" ? "unavailable" : "ignored";
}
