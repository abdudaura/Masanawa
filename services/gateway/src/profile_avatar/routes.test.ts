import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerProfileAvatarRoutes } from "./routes.js";
import { validAvatarPng } from "./test_png_fixture.js";

describe("avatar binary HTTP boundary", () => {
  it("handles exact binary PNG and returns server-authoritative URL", async () => {
    const app = Fastify();
    let seen = false;
    registerProfileAvatarRoutes(app, {
      async upload(request) {
        seen = true;
        expect(request.authorizationHeader).toBe("Bearer owner");
        expect(Buffer.isBuffer(request.png)).toBe(true);
        return { avatarUrl: "https://images.example/avatar.png" };
      },
      async remove(request) {
        expect(request.authorizationHeader).toBe("Bearer owner");
        return { avatarUrl: null };
      },
      async collectGarbage() {
        return { deleted: 0, failed: 0 };
      },
    });
    const upload = await app.inject({
      method: "POST", url: "/profiles/me/avatar",
      headers: {
        authorization: "Bearer owner",
        "content-type": "image/png",
        "x-avatar-expected": "v1:",
      },
      payload: validAvatarPng(),
    });
    expect(upload.statusCode).toBe(201);
    expect(upload.json()).toEqual({
      avatarUrl: "https://images.example/avatar.png",
    });
    expect(seen).toBe(true);
    const removed = await app.inject({
      method: "DELETE", url: "/profiles/me/avatar",
      headers: { authorization: "Bearer owner",
        "x-avatar-expected": "v1:" + Buffer.from("https://images.example/avatar.png").toString("base64url") },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ avatarUrl: null });
    await app.close();
  });

  it("refuses unexpected media types rather than accepting arbitrary JSON URLs", async () => {
    const app = Fastify();
    registerProfileAvatarRoutes(app, {
      async upload() {
        throw Error("must not be called");
      },
      async remove() {
        return { avatarUrl: null };
      },
      async collectGarbage() {
        return { deleted: 0, failed: 0 };
      },
    });
    const response = await app.inject({
      method: "POST", url: "/profiles/me/avatar",
      headers: { "content-type": "application/json" },
      payload: { avatarUrl: "https://attacker.example/tracker" },
    });
    expect(response.statusCode).toBe(415);
    await app.close();
  });
  it("requires a canonical photo version before touching owner storage", async () => {
    const app = Fastify();
    let invoked = false;
    registerProfileAvatarRoutes(app, {
      async upload() {
        invoked = true;
        return { avatarUrl: "https://images.example/avatar.png" };
      },
      async remove() {
        invoked = true;
        return { avatarUrl: null };
      },
      async collectGarbage() {
        return { deleted: 0, failed: 0 };
      },
    });
    const result = await app.inject({
      method: "POST", url: "/profiles/me/avatar",
      headers: { "content-type": "image/png" },
      payload: validAvatarPng(),
    });
    expect(result.statusCode).toBe(400);
    expect(invoked).toBe(false);
    await app.close();
  });

});
