import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { createUnifiedDiscoveryService } from "./service.js";
import { registerUnifiedDiscoveryRoutes } from "./routes.js";
import type { TalkSearchService } from "../talk_search/service.js";
import type { TalkSearchResults } from "../talk_search/model.js";

const empty = { talks: [], people: [], personas: [] } as const;
function setup(results: TalkSearchResults = empty) {
  const calls: unknown[] = [];
  const upstream: TalkSearchService = {
    async search(input) {
      calls.push(input);
      if (input.authorizationHeader !== "Bearer viewer") {
        throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
      }
      return results;
    },
  };
  const app = Fastify();
  registerUnifiedDiscoveryRoutes(app, createUnifiedDiscoveryService(upstream));
  return { app, calls };
}

describe("U30 authenticated public discovery", () => {
  it("reuses canonical search authorization and never substitutes public data on 401", async () => {
    const { app, calls } = setup();
    const denied = await app.inject({ method: "GET", url: "/v1/discovery/public?q=people" });
    expect(denied.statusCode).toBe(401);
    const allowed = await app.inject({ method: "GET", url: "/v1/discovery/public?q=people",
      headers: { authorization: "Bearer viewer" } });
    expect(allowed.statusCode).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ query: "people", type: "all", limit: 50 });
    await app.close();
  });

  it("shows named, typed public results and preserves canonical ranking", async () => {
    const { app } = setup({
      talks: [{ id: "talk_ab", title: "Health talk", hostName: "Amina", isLive: true,
        listenerCount: 8, hostAvatarUrl: null }] as unknown as TalkSearchResults["talks"],
      people: [{ handle: "amina", displayName: "Amina", bio: "", avatarUrl: null,
        isLive: false, liveTalkId: null }],
      personas: [
        { publicId: "twin_b", displayName: "B twin", kind: "twin",
          seatFeeLabel: "₦300", isAvailable: true, role: "Talker", avatarUrl: null, isVerified: false },
        { publicId: "expert_a", displayName: "A expert", kind: "expert",
          seatFeeLabel: "₦0", isAvailable: true, role: "Teacher", avatarUrl: null, isVerified: true },
      ],
    });
    const res = await app.inject({ url: "/v1/discovery/public?q=amina&limit=10",
      headers: { authorization: "Bearer viewer" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((item: { kind: string; id: string }) => [item.kind, item.id])).toEqual([
      ["talk", "talk_ab"], ["person", "amina"], ["expert", "expert_a"], ["twin", "twin_b"],
    ]);
    expect(res.json().items[3].seatFeeLabel).toBe("₦300");
    await app.close();
  });

  it("liveOnly removes ended Talks, non-live humans and non-live personas", async () => {
    const { app } = setup({
      talks: [
        { id: "live", title: "Live", hostName: "A", isLive: true, listenerCount: 1, hostAvatarUrl: null },
        { id: "past", title: "Past", hostName: "B", isLive: false, listenerCount: 0, hostAvatarUrl: null },
      ] as unknown as TalkSearchResults["talks"],
      people: [{ handle: "notlive", displayName: "Not live", bio: "", avatarUrl: null,
        isLive: false, liveTalkId: null }],
      personas: [{ publicId: "expert", displayName: "Expert", kind: "expert",
        seatFeeLabel: "", role: "", avatarUrl: null, isAvailable: true, isVerified: true }],
    });
    const res = await app.inject({ url: "/v1/discovery/public?q=live&liveOnly=true",
      headers: { authorization: "Bearer viewer" } });
    expect(res.json().items).toEqual([{
      kind: "talk", id: "live", title: "Live", subtitle: "A", isLive: true, listenerCount: 1, avatarUrl: null,
    }]);
    await app.close();
  });

  it("bounds input and slices a finite window without false continuation", async () => {
    const { app } = setup({
      talks: Array.from({ length: 50 }, (_, i) => ({
        id: "talk_" + i, title: "Talk " + i, hostName: "Host", isLive: true, listenerCount: 0, hostAvatarUrl: null,
      })) as unknown as TalkSearchResults["talks"],
      people: [], personas: [],
    });
    const first = await app.inject({ url: "/v1/discovery/public?q=talk&limit=20&offset=0",
      headers: { authorization: "Bearer viewer" } });
    expect(first.json()).toMatchObject({ nextOffset: 20, searchWindowSaturated: true });
    const last = await app.inject({ url: "/v1/discovery/public?q=talk&limit=20&offset=40",
      headers: { authorization: "Bearer viewer" } });
    expect(last.json()).toMatchObject({ nextOffset: null, searchWindowSaturated: true });
    for (const q of ["?q=x", "?q=two&limit=200", "?q=two&offset=-1",
      "?q=two&type=private_messages", "?q=two&liveOnly=maybe"]) {
      const response = await app.inject({ url: "/v1/discovery/public" + q,
        headers: { authorization: "Bearer viewer" } });
      expect(response.statusCode).toBe(400);
    }
    await app.close();
  });

  it("flags a single saturated group even when other groups are empty", async () => {
    const { app } = setup({
      talks: Array.from({ length: 17 }, (_, i) => ({
        id: "talk_" + i, title: "Talk", hostName: "Host", isLive: true,
        listenerCount: 0, hostAvatarUrl: null,
      })) as unknown as TalkSearchResults["talks"],
      people: [], personas: [],
    });
    const res = await app.inject({ url: "/v1/discovery/public?q=talk",
      headers: { authorization: "Bearer viewer" } });
    expect(res.json().searchWindowSaturated).toBe(true);
    await app.close();
  });
});

