/**
 * Masanawa official external video admission policy.
 * This module generates only provider-owned embed URLs; it never downloads,
 * rehosts or rewrites video bytes. Keep credentials and admin HTML out.
 */
export type VideoProvider = "youtube" | "tiktok" | "facebook";
export type AdmissionState = "pending" | "approved" | "unavailable";

export interface ExternalVideo {
  readonly provider: VideoProvider;
  readonly providerVideoId: string;
  readonly canonicalUrl: string;
  readonly embedUrl: string;
  readonly channelName: string;
  readonly state: AdmissionState;
  readonly verifiedEmbeddable: boolean;
  readonly regionAllowed: boolean;
}

export class VideoAdmissionError extends Error {
  constructor(readonly code: "unsafe_url" | "unsupported_provider" | "invalid_video_id" | "missing_attribution" | "not_embeddable") {
    super(code);
  }
}

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const TIKTOK_ID = /^\d{15,24}$/;
const FB_ID = /^\d{5,30}$/;
function httpsUrl(input: string): URL {
  let u: URL;
  try { u = new URL(input); } catch { throw new VideoAdmissionError("unsafe_url"); }
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash) throw new VideoAdmissionError("unsafe_url");
  return u;
}

/** Admission uses exact provider domains. Subdomain tricks and redirect links are rejected. */
export function parseExternalVideoUrl(input: string): Pick<ExternalVideo, "provider" | "providerVideoId" | "canonicalUrl" | "embedUrl"> {
  const u = httpsUrl(input);
  const host = u.hostname.toLowerCase();
  if (host === "youtu.be" || host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
    const id = host === "youtu.be" ? u.pathname.slice(1) :
      u.pathname === "/watch" ? u.searchParams.get("v") ?? "" :
      u.pathname.startsWith("/shorts/") ? u.pathname.slice(8) :
      u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : "";
    if (!YOUTUBE_ID.test(id)) throw new VideoAdmissionError("invalid_video_id");
    return {provider:"youtube",providerVideoId:id,canonicalUrl:`https://www.youtube.com/watch?v=${id}`,embedUrl:`https://www.youtube.com/embed/${id}`};
  }
  if (host === "www.tiktok.com" || host === "tiktok.com") {
    const match = /^\/@[A-Za-z0-9._]{2,32}\/video\/(\d{15,24})\/?$/.exec(u.pathname);
    if (!match || !TIKTOK_ID.test(match[1]!)) throw new VideoAdmissionError("invalid_video_id");
    const id = match[1]!;
    return {provider:"tiktok",providerVideoId:id,canonicalUrl:`https://www.tiktok.com${u.pathname.replace(/\/$/, "")}`,embedUrl:`https://www.tiktok.com/player/v1/${id}`};
  }
  if (host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com") {
    const match = /^\/(?:watch\/?|reel\/|videos\/)(\d{5,30})\/?$/.exec(u.pathname);
    const id = match?.[1] ?? (u.pathname === "/watch/" || u.pathname === "/watch" ? u.searchParams.get("v") : null);
    if (!id || !FB_ID.test(id)) throw new VideoAdmissionError("invalid_video_id");
    const canonicalUrl = `https://www.facebook.com/watch/?v=${id}`;
    return {provider:"facebook",providerVideoId:id,canonicalUrl,embedUrl:`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonicalUrl)}`};
  }
  throw new VideoAdmissionError("unsupported_provider");
}

export function admitVerifiedVideo(input: {
  url: string;
  channelName: string;
  verifiedEmbeddable: boolean;
  regionAllowed: boolean;
}): ExternalVideo {
  const url = parseExternalVideoUrl(input.url);
  const channelName = input.channelName.trim();
  if (!channelName || channelName.length > 140) throw new VideoAdmissionError("missing_attribution");
  if (!input.verifiedEmbeddable || !input.regionAllowed) throw new VideoAdmissionError("not_embeddable");
  return {...url,channelName,state:"pending",verifiedEmbeddable:true,regionAllowed:true};
}

/** Only an explicitly approved, still playable provider video is visible to fans. */
export function visibleVideo(video: ExternalVideo): boolean {
  return video.state === "approved" && video.verifiedEmbeddable === true && video.regionAllowed === true;
}
