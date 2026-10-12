import type { FastifyInstance } from "fastify";
import Type from "typebox";
import type { IncomingCallService } from "./service.js";
import { IncomingCallError } from "./service.js";
function keys(value: unknown, allowed: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    throw new IncomingCallError("incoming.invalid_request", 400);
}
const params = Type.Object(
  { callId: Type.String({ minLength: 36, maxLength: 36 }) },
  { additionalProperties: false },
);
const account = {
  tenantId: Type.String({ minLength: 1, maxLength: 160 }),
  userId: Type.String({ minLength: 1, maxLength: 160 }),
  characterId: Type.String({ minLength: 1, maxLength: 160 }),
};
export function registerIncomingCallRoutes(
  app: FastifyInstance,
  service: IncomingCallService,
): void {
  const auth = (r: { headers: { authorization?: string | undefined } }) =>
    r.headers.authorization
      ? { authorizationHeader: r.headers.authorization }
      : {};
  app.get(
    "/v1/calls/incoming",
    { preValidation: async (r) => keys(r.query, []) },
    (r) => service.list(auth(r)),
  );
  app.get("/v1/calls/incoming/:callId", { schema: { params } }, async (r) => ({
    call: await service.get({
      ...auth(r),
      ...(r.params as { callId: string }),
    }),
  }));
  for (const [path, state] of [
    ["accept", "accepted"],
    ["decline", "declined"],
  ] as const)
    app.post(
      `/v1/calls/incoming/:callId/${path}`,
      {
        preValidation: async (r) => keys(r.body, []),
        schema: {
          params,
          body: Type.Object({}, { additionalProperties: false }),
        },
      },
      async (r) => ({
        call: await service.respond({
          ...auth(r),
          ...(r.params as { callId: string }),
          state,
        }),
      }),
    );
  app.post(
    "/v1/calls/incoming/:callId/token",
    {
      preValidation: async (r) => keys(r.body, ["admissionId"]),
      schema: {
        params,
        body: Type.Object(
          { admissionId: Type.String({ minLength: 1, maxLength: 160 }) },
          { additionalProperties: false },
        ),
      },
    },
    (r) =>
      service.token({
        ...auth(r),
        ...(r.params as { callId: string }),
        ...(r.body as { admissionId: string }),
      }),
  );
  app.post(
    "/internal/calls/incoming",
    {
      preValidation: async (r) =>
        keys(r.body, [
          "tenantId",
          "userId",
          "characterId",
          "requestId",
          "ringDurationMs",
        ]),
      schema: {
        body: Type.Object(
          {
            ...account,
            requestId: Type.String({ minLength: 1, maxLength: 128 }),
            ringDurationMs: Type.Optional(
              Type.Integer({ minimum: 1000, maximum: 120000 }),
            ),
          },
          { additionalProperties: false },
        ),
      },
    },
    (r) =>
      service.initiate({
        ...auth(r),
        ...(r.body as Parameters<IncomingCallService["initiate"]>[0]),
      }),
  );
  app.post(
    "/internal/calls/incoming/:callId/cancel",
    {
      preValidation: async (r) =>
        keys(r.body, ["tenantId", "userId", "characterId"]),
      schema: {
        params,
        body: Type.Object(account, { additionalProperties: false }),
      },
    },
    (r) =>
      service.cancel({
        ...auth(r),
        ...(r.params as { callId: string }),
        ...(r.body as {
          tenantId: string;
          userId: string;
          characterId: string;
        }),
      }),
  );
}
