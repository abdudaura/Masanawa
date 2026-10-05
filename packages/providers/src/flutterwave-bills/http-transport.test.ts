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

  it("uses relay bearer auth without forwarding the Flutterwave provider secret", async () => {
    let seenUrl = "";
    let seenHeaders: Headers | undefined;
    const transport = new FlutterwaveHttpTransport({
      baseUrl: "https://relay.example.test",
      relayToken: "relay-secret",
      fetchImpl: async (input, init) => {
        seenUrl = String(input);
        seenHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ status: "success", data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    await transport.request({
      method: "GET",
      path: "/v3/top-bill-categories",
      query: { country: "NG" },
      headers: { authorization: "Bearer flutterwave-provider-secret", accept: "application/json" },
    });
    expect(seenUrl).toBe("https://relay.example.test/v3/top-bill-categories?country=NG");
    expect(seenHeaders?.get("authorization")).toBe("Bearer relay-secret");
    expect(seenHeaders?.get("authorization")).not.toContain("flutterwave-provider-secret");
  });

  it("rejects insecure relay/base origins and oversized relay tokens", () => {
    expect(() => new FlutterwaveHttpTransport({
      baseUrl: "http://relay.example.test",
      relayToken: "relay-secret",
    })).toThrow("must use HTTPS");
    expect(() => new FlutterwaveHttpTransport({
      baseUrl: "https://relay.example.test",
      relayToken: "x".repeat(1025),
    })).toThrow("relay token is invalid");
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
  it("uses distinct client and upstream credentials for the fixed-IP relay and forbids redirects", async () => {
    let seen: RequestInit | undefined;
    const transport = new FlutterwaveHttpTransport({baseUrl: "https://relay.example.test", relayToken: "relay-secret", relayProtocol: "dual-header", fetchImpl: async (_url, init) => { seen = init; return new Response("{}", {status: 200}); }});
    await transport.request({method: "GET", path: "/v3/top-bill-categories", headers: {authorization: "Bearer provider-secret"}});
    const headers = new Headers(seen?.headers);
    expect(headers.get("authorization")).toBe("Bearer provider-secret");
    expect(headers.get("x-masanawa-relay-token")).toBe("relay-secret");
    expect(seen?.redirect).toBe("error");
  });

  it("rejects dual-header mode without authentication and credential-bearing base URLs", () => {
    expect(() => new FlutterwaveHttpTransport({relayProtocol: "dual-header"})).toThrow("protocol is invalid");
    expect(() => new FlutterwaveHttpTransport({baseUrl: "https://user:secret@relay.example.test"})).toThrow("must not contain credentials");
  });

});

