/** L-VIDEO: no API permission => no unattended sync, fetch, scrape or repost. */
export type VideoSourceMode = "manual" | "auto";
export interface SourceEligibility {
  readonly provider: "youtube" | "tiktok" | "facebook";
  readonly mode: VideoSourceMode;
  readonly enabled: boolean;
  readonly authorizationStatus: "verified" | "missing" | "expired" | "revoked";
  readonly providerCapability: "youtube_websub" | "tiktok_display_api" | "meta_page_graph" | null;
}
export function mayScheduleExternalVideoImport(source: SourceEligibility): boolean {
  if (!source.enabled || source.mode !== "auto" || source.authorizationStatus !== "verified") return false;
  return source.providerCapability === (
    source.provider === "youtube" ? "youtube_websub" :
    source.provider === "tiktok" ? "tiktok_display_api" : "meta_page_graph"
  );
}
export interface SourceScheduler {
  eligibleSources(): Promise<readonly SourceEligibility[]>;
  scheduleAuthorized(source: SourceEligibility): Promise<void>;
}
export async function scheduleAuthorizedVideoImports(store: SourceScheduler, disabled: boolean): Promise<number> {
  if (disabled) return 0;
  let scheduled=0;
  for (const source of await store.eligibleSources()) {
    if (!mayScheduleExternalVideoImport(source)) continue;
    await store.scheduleAuthorized(source); // caller supplies existing durable outbox + lease authority
    scheduled++;
  }
  return scheduled;
}
