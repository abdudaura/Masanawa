import type { YouTubeDataApi, YouTubeVideoMetadata } from "./youtube_api.js";
export interface YouTubeSyncSource {
  readonly tenantId: string;
  readonly sourceId: string;
  readonly channelId: string;
  readonly channelName: string;
  readonly targetRegion: string;
  /** All are checked when the job executes, not just at enqueue time. */
  readonly enabled: boolean;
  readonly apiQualified: boolean;
  readonly mode: "authorized_api" | "manual";
}
export interface YouTubeQuota {
  /** Must atomically reserve actual Data API quota before every request. */
  reserve(tenantId: string, units: number): Promise<boolean>;
}
export interface YouTubeCatalogSink {
  /** Idempotent in the existing external_videos store. Never autoapprove. */
  stagePending(input: {
    tenantId:string; sourceId:string; provider:"youtube"; providerVideoId:string;
    sourceUrl:string; title:string; channelName:string;
  }): Promise<void>;
  /** Fail closed if official status becomes ineligible; never edit financial/other sources. */
  markUnavailable(input: {tenantId:string; sourceId:string;providerVideoId:string}):Promise<void>;
}
export class YouTubeSyncError extends Error {
  constructor(readonly code: "unauthorized_source" | "quota_exhausted" | "invalid_source") { super(code); }
}
const channel = /^UC[A-Za-z0-9_-]{22}$/u;
function eligible(video: YouTubeVideoMetadata, expectedChannel: string, region: string): boolean {
  return video.channelId===expectedChannel && video.privacyStatus==="public" &&
    video.embeddable && video.title.trim().length>0 &&
    !video.blockedRegions.includes(region) &&
    (video.allowedRegions===null || video.allowedRegions.includes(region));
}
export function createYouTubeReconciler(deps: {api:YouTubeDataApi;quota:YouTubeQuota;catalog:YouTubeCatalogSink}) {
  async function reserve(tenantId:string) {
    if (!(await deps.quota.reserve(tenantId,1))) throw new YouTubeSyncError("quota_exhausted");
  }
  return {
    /** At most two pages / 100 candidates per invocation. Cursor is returned to
     * the canonical outbox follow-up, not stored in an alternate job journal.
     * First daily/WebSub invocation always starts from page 1 for fresh uploads. */
    async reconcile(source:YouTubeSyncSource, options:{pageToken?:string;maxPages?:number}={}) {
      if (!source.enabled || !source.apiQualified || source.mode!=="authorized_api")
        throw new YouTubeSyncError("unauthorized_source");
      if (!source.tenantId || !source.sourceId || !channel.test(source.channelId) ||
        !/^[A-Z]{2}$/u.test(source.targetRegion) || !source.channelName.trim())
        throw new YouTubeSyncError("invalid_source");
      const maxPages=options.maxPages??2;
      if (!Number.isInteger(maxPages) || maxPages<1 || maxPages>2) throw new YouTubeSyncError("invalid_source");
      await reserve(source.tenantId);
      const playlistId=await deps.api.uploadsPlaylist(source.channelId);
      let pageToken=options.pageToken;
      let staged=0, unavailable=0, pages=0;
      for(let i=0;i<maxPages;i++) {
        await reserve(source.tenantId);
        const page=await deps.api.uploadsPage(playlistId,pageToken);
        pages++;
        if(page.ids.length>0) {
          await reserve(source.tenantId);
          const videos=await deps.api.videos(page.ids);
          const byId=new Map(videos.map(v=>[v.id,v]));
          for(const id of page.ids) {
            const detail=byId.get(id);
            if(!detail || !eligible(detail,source.channelId,source.targetRegion)) {
              await deps.catalog.markUnavailable({tenantId:source.tenantId,sourceId:source.sourceId,providerVideoId:id});
              unavailable++;
            } else {
              await deps.catalog.stagePending({
                tenantId:source.tenantId,sourceId:source.sourceId,provider:"youtube",
                providerVideoId:id,sourceUrl:`https://www.youtube.com/watch?v=${id}`,
                title:detail.title.slice(0,180),channelName:source.channelName,
              });
              staged++;
            }
          }
        }
        if(!page.nextPageToken) return {staged,unavailable,pages,nextPageToken:null};
        pageToken=page.nextPageToken;
      }
      return {staged,unavailable,pages,nextPageToken:pageToken??null};
    },
  };
}

/** Pure operation adapter for the EXISTING leased events.outbox. The caller
 * claims the job with a fence, obtains current server-owned source settings,
 * calls this handler, and ACKs only after the writes complete. Failures go
 * through canonical outbox retry/dead-letter handling. */
export async function processYouTubeOutbox(
  event: {tenantId:string;sourceId:string;eventType:string},
  loadSource:(tenantId:string,sourceId:string)=>Promise<YouTubeSyncSource|null>,
  reconcile:(source:YouTubeSyncSource)=>Promise<unknown>,
): Promise<void> {
  if(event.eventType!=="youtube.reconcile.requested") throw new YouTubeSyncError("invalid_source");
  const source=await loadSource(event.tenantId,event.sourceId);
  if (!source || source.tenantId!==event.tenantId || source.sourceId!==event.sourceId)
    throw new YouTubeSyncError("unauthorized_source");
  await reconcile(source);
}
