/** Canonical v1 public metadata. No downloaded/rehosted video bytes or HTML. */
export type VideoProvider = "youtube" | "tiktok" | "facebook";
export type VideoReviewState = "pending" | "approved" | "hidden" | "unavailable";
export interface ExternalVideo {
  readonly id: string;
  readonly tenantId: string;
  readonly provider: VideoProvider;
  readonly providerVideoId: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly channelName: string;
  readonly reviewState: VideoReviewState;
  readonly verifiedAt: string | null;
  readonly createdAt: string;
}
export interface VideoPrincipal {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly staffRoles: readonly string[];
}
export interface ManualVideoInput {
  readonly url: string;
  readonly title: string;
  readonly channelName: string;
}
const youtubeId = /^[a-zA-Z0-9_-]{11}$/u;
const facebookId = /^[0-9]{7,30}$/u;
const tiktokId = /^[0-9]{12,25}$/u;
function invalid(): never { throw new TypeError("Unsupported or malformed official video URL"); }
/** Parse only canonical provider domains; reject redirect, spoof, port and arbitrary embed URLs. */
export function parseExternalVideoUrl(raw: string): {
  provider: VideoProvider; providerVideoId: string; sourceUrl: string;
} {
  if (typeof raw !== "string" || raw.length > 1000) invalid();
  let url: URL;
  try { url = new URL(raw); } catch { return invalid(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) invalid();
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = segments.length === 1 ? segments[0] : undefined;
    if (!id || !youtubeId.test(id)) invalid();
    return { provider: "youtube", providerVideoId: id, sourceUrl: "https://www.youtube.com/watch?v=" + id };
  }
  if (["youtube.com","www.youtube.com","m.youtube.com"].includes(host)) {
    const id = url.pathname === "/watch" ? url.searchParams.get("v") : segments[0] === "shorts" || segments[0] === "live" ? segments[1] : null;
    if (!id || !youtubeId.test(id)) invalid();
    return { provider: "youtube", providerVideoId: id, sourceUrl: "https://www.youtube.com/watch?v=" + id };
  }
  if (host === "www.tiktok.com" || host === "tiktok.com" || host === "m.tiktok.com") {
    const match = /^\/@([a-zA-Z0-9._-]{2,32})\/video\/([0-9]{12,25})\/?$/u.exec(url.pathname);
    if (!match || !tiktokId.test(match[2]!)) invalid();
    return { provider: "tiktok", providerVideoId: match[2]!, sourceUrl: "https://www.tiktok.com/@" + match[1] + "/video/" + match[2] };
  }
  if (["facebook.com","www.facebook.com","m.facebook.com","web.facebook.com"].includes(host)) {
    const index = segments.indexOf("videos");
    const id = index >= 0 ? segments[index + 1] : url.pathname === "/watch/" || url.pathname === "/watch" ? url.searchParams.get("v") : null;
    if (!id || !facebookId.test(id)) invalid();
    // Preserve the canonical watch URL, not a user-controlled redirect parameter.
    return { provider: "facebook", providerVideoId: id, sourceUrl: "https://www.facebook.com/watch/?v=" + id };
  }
  return invalid();
}
export function strictManualVideoInput(value: unknown): ManualVideoInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid video input");
  const x = value as Record<string, unknown>;
  if (Object.keys(x).sort().join(",") !== "channelName,title,url") throw new TypeError("Unexpected video input fields");
  for (const key of ["url","title","channelName"] as const) {
    if (typeof x[key] !== "string" || !(x[key] as string).trim()) throw new TypeError("Missing video metadata");
  }
  const title = (x.title as string).trim(), channelName = (x.channelName as string).trim();
  if (title.length > 180 || channelName.length > 100) throw new TypeError("Video metadata too long");
  return { url: x.url as string, title, channelName };
}
