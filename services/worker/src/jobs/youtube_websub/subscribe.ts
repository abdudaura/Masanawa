/**
 * Server-initiated PubSubHubbub lease renewal for an admin-approved YouTube
 * channel. Official endpoint ONLY; neither the channel owner nor a fan can
 * control callback hosts, arbitrary HTTP targets or automation permissions.
 * An accepted POST is only a REQUEST, never proof of an active subscription.
 */
const HUB_URL = "https://pubsubhubbub.appspot.com/subscribe";
const channelPattern = /^UC[A-Za-z0-9_-]{22}$/u;
const tokenPattern = /^[A-Za-z0-9_-]{32,128}$/u;
export interface YouTubeLeaseRequest {
  readonly tenantId: string;
  readonly sourceId: string;
  readonly channelId: string;
  readonly callbackToken: string;
  readonly signatureSecret: string;
  readonly enabled: boolean;
  readonly apiQualified: boolean;
  readonly mode: "authorized_api" | "manual";
}
export class YouTubeLeaseError extends Error {
  constructor(readonly code:"invalid_source"|"not_authorized"|"hub_unavailable") { super(code); }
}
export function createYouTubeHubSubscriber(input: {
  /** Trusted deployment config; no arbitrary caller-provided callback domain. */
  callbackBaseUrl: string;
  allowedCallbackHost: string;
  fetchImpl?: typeof fetch;
  /** Durable pending record must exist BEFORE the hub's callback challenge. */
  markLeaseRequested: (tenantId:string,sourceId:string)=>Promise<void>;
}) {
  let base: URL;
  try { base = new URL(input.callbackBaseUrl); }
  catch {throw new YouTubeLeaseError("invalid_source");}
  if(base.protocol!=="https:" || base.hostname!==input.allowedCallbackHost ||
    base.username || base.password || base.port || base.search || base.hash ||
    base.pathname!=="/") throw new YouTubeLeaseError("invalid_source");
  const fetchImpl=input.fetchImpl??fetch;
  return {
    /** Scheduler invokes only when canonical source says a lease is due. */
    async requestLease(source:YouTubeLeaseRequest):Promise<{requested:true;verified:false}> {
      if(!source.enabled || !source.apiQualified || source.mode!=="authorized_api")
        throw new YouTubeLeaseError("not_authorized");
      if(!source.tenantId || !source.sourceId || !channelPattern.test(source.channelId) ||
        !tokenPattern.test(source.callbackToken) || source.signatureSecret.length<32)
        throw new YouTubeLeaseError("invalid_source");
      const body=new URLSearchParams({
        "hub.callback":new URL("v1/webhooks/youtube/"+source.callbackToken,base).toString(),
        "hub.mode":"subscribe",
        "hub.topic":"https://www.youtube.com/xml/feeds/videos.xml?channel_id="+source.channelId,
        "hub.verify":"async",
        "hub.secret":source.signatureSecret,
        "hub.lease_seconds":"432000",
      });
      await input.markLeaseRequested(source.tenantId,source.sourceId);
      let response:Response;
      try {
        response=await fetchImpl(HUB_URL,{
          method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
          body:body.toString(),signal:AbortSignal.timeout(10000),
        });
      } catch {throw new YouTubeLeaseError("hub_unavailable");}
      if(!response.ok) throw new YouTubeLeaseError("hub_unavailable");
      // Only the later matched hub GET challenge confirms activation.
      return {requested:true,verified:false};
    },
  };
}
