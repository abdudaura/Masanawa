import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile Alpha API compatibility", () => {
  it("uses the same supported versioned directory/session routes as Gateway", () => {
    const gateway = fs.readFileSync("services/gateway/src/app.ts", "utf8");
    const mobile = fs.readFileSync("apps/mobile/lib/src/agents/masanawa_transport.dart", "utf8");
    const expected = [
      "/v1/agent/directory", "/v1/agent/sessions/open",
      "/v1/agent/sessions/:characterSessionId/turn",
      "/v1/agent/sessions/:characterSessionId/media-turn",
      "/v1/agent/sessions/:characterSessionId/close",
    ];
    const normalize = (source: string) => source.replace(
      /\$\{binding\.characterSessionId\}/gu, ":characterSessionId",
    );
    const routes = (source: string) => [...normalize(source).matchAll(
      /["'](\/v1\/agent\/[^"']+)["']/gu,
    )].map((match) => match[1]).sort();
    expect(routes(mobile)).toEqual([...expected].sort());
    for (const route of expected) expect(gateway).toContain(`"${route}"`);
    expect(mobile).not.toMatch(/["']\/agent\//u);
  });
});
