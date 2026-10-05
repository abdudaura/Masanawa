import { afterEach, describe, expect, it } from "vitest";
import type { AdminAgentActionBroker } from "./admin_agent_actions.js";
import { createOpsApp } from "./app.js";

const apps: Array<ReturnType<typeof createOpsApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Ops admin Agent action routes", () => {
  it("forwards operator session, Character and bounded action payload", async () => {
    const calls: unknown[] = [];
    const broker = {
      async execute(input: unknown) {
        calls.push(input);
        return {
          status: "completed",
          action: "users.list",
          data: [],
        };
      },
    } as AdminAgentActionBroker;

    const app = createOpsApp({ adminAgentActions: broker });
    apps.push(app);

    const characterId =
      "character_00000000-0000-4000-8000-000000000001";
    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/delegates/${characterId}/actions`,
      headers: { authorization: "Bearer operator-session" },
      payload: {
        action: "users.list",
        arguments: { state: "active", limit: 25 },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator-session",
      characterId,
      action: "users.list",
      arguments: { state: "active", limit: 25 },
    }]);
  });

  it("rejects unknown admin action keys before broker execution", async () => {
    let calls = 0;
    const broker = {
      async execute() {
        calls += 1;
        throw new Error("should not run");
      },
    } as unknown as AdminAgentActionBroker;

    const app = createOpsApp({ adminAgentActions: broker });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/delegates/"
        + "character_00000000-0000-4000-8000-000000000001/actions",
      headers: { authorization: "Bearer operator-session" },
      payload: {
        action: "sql.execute",
        arguments: { query: "DROP TABLE anything" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(calls).toBe(0);
  });
});
