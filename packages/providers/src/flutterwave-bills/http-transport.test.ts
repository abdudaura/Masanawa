import { describe, expect, it } from "vitest";
import { FlutterwaveHttpTransport } from "./http-transport.js";

describe("FlutterwaveHttpTransport", () => {
  it("builds bounded JSON requests against the official API origin", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      seenUrl = String(input);
      seenInit = init;
      return new Response(JSON.stringify({ status: "success", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const transport = new FlutterwaveHttpTransport({ fetchImpl });
    await transport.request({
      method: "GET",
      path: "/v3/top-bill-categories",
      query: { country: "NG" },
      headers: { authorization: "Bearer secret" },
    });
    expect(seenUrl).toBe("https://api.flutterwave.com/v3/top-bill-categories?country=NG");
    expect(seenInit?.method).toBe("GET");
  });

  it("does not throw provider response text when JSON is malformed", async () => {
    const transport = new FlutterwaveHttpTransport({
      fetchImpl: async () => new Response("<html>upstream failure</html>", { status: 502 }),
    });
    await expect(
      transport.request({ method: "GET", path: "/v3/test", headers: {} }),
    ).resolves.toEqual({ status: 502, body: null });
  });

  it("rejects unreasonable timeout configuration", () => {
    expect(() => new FlutterwaveHttpTransport({ timeoutMs: 100 })).toThrow(
      "Flutterwave HTTP timeout is invalid",
    );
  });
});
