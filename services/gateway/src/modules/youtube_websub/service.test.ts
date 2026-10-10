import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createYouTubeWebSubService, youtubeTopic, type YouTubeWebSubStore } from "./service.js";
const channel = "UC" + "A".repeat(22);
const token = "a".repeat(48);
const secret = "s".repeat(40);
const subscription = {tenantId:"tenant1",sourceId:"video-source1",channelId:channel,signatureSecret:secret,enabled:true,authorized:true};
function harness(overrides: Partial<typeof subscription> = {}) {
  const seen = new Set<string>();
  let enqueued = 0;
  const store: YouTubeWebSubStore = {
    findByCallbackToken: async () => ({...subscription,...overrides}),
    enqueueReconciliation: async x => { if (seen.has(x.operationKey)) return false;seen.add(x.operationKey);enqueued++;return true; },
  };
  return {handler:createYouTubeWebSubService(store),queued:()=>enqueued};
}
describe("YouTube WebSub provider admission", () => {
  it("answers exact channel-specific challenge", async () => {
    const {handler} = harness();
    await expect(handler.verifyChallenge(token, {"hub.mode":"subscribe","hub.topic":youtubeTopic(channel),"hub.challenge":"hello","hub.lease_seconds":"86400"})).resolves.toBe("hello");
  });
  it("rejects cross-channel challenge and disabled source", async () => {
    const {handler}=harness();
    await expect(handler.verifyChallenge(token, {"hub.mode":"subscribe","hub.topic":youtubeTopic("UC"+"B".repeat(22)),"hub.challenge":"x"})).rejects.toMatchObject({status:400});
    await expect(harness({enabled:false}).handler.verifyChallenge(token, {"hub.mode":"subscribe","hub.topic":youtubeTopic(channel),"hub.challenge":"x"})).rejects.toMatchObject({status:404});
  });
  it("requires HMAC and dedupes exact provider delivery", async () => {
    const {handler,queued}=harness();
    const body=Buffer.from("<feed><entry><title>new</title></entry></feed>");
    await expect(handler.notify(token,body,undefined)).rejects.toMatchObject({status:401});
    await expect(handler.notify(token,body,"sha1="+"0".repeat(40))).rejects.toMatchObject({status:401});
    const sig="sha1="+createHmac("sha1",secret).update(body).digest("hex");
    await expect(handler.notify(token,body,sig)).resolves.toEqual({accepted:true,duplicate:false});
    await expect(handler.notify(token,body,sig)).resolves.toEqual({accepted:true,duplicate:true});
    expect(queued()).toBe(1);
  });
  it("does not enqueue unauthorized or oversize messages", async () => {
    const h=harness({authorized:false});
    await expect(h.handler.notify(token,Buffer.from("more than twenty bytes"),"sha1="+"1".repeat(40))).rejects.toMatchObject({status:404});
    expect(h.queued()).toBe(0);
    await expect(harness().handler.notify(token,Buffer.alloc(65537),undefined)).rejects.toMatchObject({status:413});
  });
});
