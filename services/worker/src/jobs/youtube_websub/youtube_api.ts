/**
 * Official YouTube Data API v3 read-only adapter. Only the Google API origin
 * is contacted. Credentials stay server-side and never enter logs or events.
 * https://developers.google.com/youtube/v3/docs/
 */
export class YouTubeDataError extends Error {
  constructor(readonly status: number) { super("youtube_data_unavailable"); }
}
export interface YouTubeVideoMetadata {
  readonly id: string;
  readonly channelId: string;
  readonly privacyStatus: string;
  readonly embeddable: boolean;
  readonly title: string;
  readonly blockedRegions: readonly string[];
  readonly allowedRegions: readonly string[] | null;
}
export interface YouTubeUploadsPage {
  readonly ids: readonly string[];
  readonly nextPageToken: string | null;
}
export interface YouTubeDataApi {
  uploadsPlaylist(channelId: string): Promise<string>;
  uploadsPage(playlistId: string, pageToken?: string): Promise<YouTubeUploadsPage>;
  videos(ids: readonly string[]): Promise<readonly YouTubeVideoMetadata[]>;
}
const channelPattern = /^UC[A-Za-z0-9_-]{22}$/u;
const videoPattern = /^[A-Za-z0-9_-]{11}$/u;
const playlistPattern = /^[A-Za-z0-9_-]{2,120}$/u;
type FetchLike = typeof fetch;
export function createYouTubeDataApi(input: {apiKey: string; fetchImpl?: FetchLike}): YouTubeDataApi {
  if (!input.apiKey.trim()) throw new Error("youtube_api_key_missing");
  const fetchImpl = input.fetchImpl ?? fetch;
  async function call(path: "channels" | "playlistItems" | "videos", params: Readonly<Record<string,string>>): Promise<Record<string,unknown>> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
    url.searchParams.set("key",input.apiKey);
    let result: Response;
    try { result = await fetchImpl(url, {method:"GET",headers:{accept:"application/json"},signal:AbortSignal.timeout(10000)}); }
    catch { throw new YouTubeDataError(503); }
    if (!result.ok) throw new YouTubeDataError(result.status);
    let json: unknown;
    try {json = await result.json();} catch {throw new YouTubeDataError(502);}
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new YouTubeDataError(502);
    return json as Record<string,unknown>;
  }
  function itemsOf(value: unknown): Record<string,unknown>[] {
    if (!Array.isArray(value)) throw new YouTubeDataError(502);
    return value.filter((x):x is Record<string,unknown> => Boolean(x && typeof x==="object" && !Array.isArray(x)));
  }
  function nested(x: Record<string,unknown>, key:string): Record<string,unknown> {
    const value=x[key];
    return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  }
  return {
    async uploadsPlaylist(channelId) {
      if (!channelPattern.test(channelId)) throw new Error("youtube_invalid_channel");
      const body=await call("channels",{part:"contentDetails",id:channelId,maxResults:"1"});
      const channel=itemsOf(body.items).find(x=>x.id===channelId);
      const playlist=nested(nested(channel??{},"contentDetails"),"relatedPlaylists").uploads;
      if (typeof playlist!=="string" || !playlistPattern.test(playlist)) throw new YouTubeDataError(404);
      return playlist;
    },
    async uploadsPage(playlistId,pageToken) {
      if (!playlistPattern.test(playlistId) || (pageToken!==undefined && (!pageToken || pageToken.length>180))) throw new Error("youtube_invalid_page");
      const body=await call("playlistItems",{
        part:"snippet",playlistId,maxResults:"50",
        ...(pageToken===undefined?{}:{pageToken}),
      });
      const ids=itemsOf(body.items).map(x=>nested(nested(x,"snippet"),"resourceId").videoId)
        .filter((x):x is string=>typeof x==="string" && videoPattern.test(x));
      const unique=[...new Set(ids)];
      const next=body.nextPageToken;
      return {ids:unique,nextPageToken:typeof next==="string" && next.length>0 && next.length<=180?next:null};
    },
    async videos(ids) {
      if (ids.length<1 || ids.length>50 || ids.some(x=>!videoPattern.test(x))) throw new Error("youtube_invalid_video_ids");
      const body=await call("videos",{part:"status,snippet,contentDetails",id:ids.join(","),maxResults:"50"});
      return itemsOf(body.items).filter(x=>typeof x.id==="string" && videoPattern.test(x.id))
        .map(x=>{
          const status=nested(x,"status"), snippet=nested(x,"snippet");
          const restrictions=nested(nested(x,"contentDetails"),"regionRestriction");
          return {
            id:x.id as string,channelId:typeof snippet.channelId==="string"?snippet.channelId:"",
            privacyStatus:typeof status.privacyStatus==="string"?status.privacyStatus:"",
            embeddable:status.embeddable===true,
            title:typeof snippet.title==="string"?snippet.title.slice(0,180):"",
            blockedRegions:Array.isArray(restrictions.blocked)?restrictions.blocked.filter((v):v is string=>typeof v==="string"):[],
            allowedRegions:Array.isArray(restrictions.allowed)?restrictions.allowed.filter((v):v is string=>typeof v==="string"):null,
          };
        });
    },
  };
}
