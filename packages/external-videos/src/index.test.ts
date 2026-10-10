import { describe, expect, it } from "vitest";
import { admitVerifiedVideo, parseExternalVideoUrl, visibleVideo, VideoAdmissionError } from "./index.js";

describe("official external-video admission", () => {
  it("normalizes YouTube watch and shorts into an official embed", () => {
    expect(parseExternalVideoUrl("https://youtu.be/dQw4w9WgXcQ").embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(parseExternalVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ").providerVideoId).toBe("dQw4w9WgXcQ");
  });
  it("uses provider players for TikTok and Facebook", () => {
    expect(parseExternalVideoUrl("https://www.tiktok.com/@creator/video/7351112223334445556").embedUrl).toContain("tiktok.com/player/v1/");
    expect(parseExternalVideoUrl("https://www.facebook.com/watch/?v=123456789").embedUrl).toContain("facebook.com/plugins/video.php");
  });
  it.each(["http://youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://evil.test/video/1234567", "https://user:pass@youtu.be/dQw4w9WgXcQ"])("denies unsafe input %s", url => {
    expect(() => parseExternalVideoUrl(url)).toThrow(VideoAdmissionError);
  });
  it("requires attribution and real embed eligibility, not an admin toggle", () => {
    expect(() => admitVerifiedVideo({url:"https://youtu.be/dQw4w9WgXcQ",channelName:"",verifiedEmbeddable:true,regionAllowed:true})).toThrow("missing_attribution");
    expect(() => admitVerifiedVideo({url:"https://youtu.be/dQw4w9WgXcQ",channelName:"Channel",verifiedEmbeddable:false,regionAllowed:true})).toThrow("not_embeddable");
  });
  it("never exposes pending or unavailable media", () => {
    const v = admitVerifiedVideo({url:"https://youtu.be/dQw4w9WgXcQ",channelName:"Official Channel",verifiedEmbeddable:true,regionAllowed:true});
    expect(visibleVideo(v)).toBe(false);
    expect(visibleVideo({...v,state:"approved"})).toBe(true);
    expect(visibleVideo({...v,state:"unavailable"})).toBe(false);
    expect(visibleVideo({...v,state:"approved",regionAllowed:false})).toBe(false);
  });
});
