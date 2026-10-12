import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { GroupCallError, type GroupCallService } from "./service.js";
const text = Type.String({ minLength: 1, maxLength: 200 });
const groupParams = Type.Object(
  { groupId: Type.String({ minLength: 36, maxLength: 36 }) },
  { additionalProperties: false },
);
const memberParams = Type.Object(
  { groupId: Type.String({ minLength: 36, maxLength: 36 }), characterId: text },
  { additionalProperties: false },
);
function keys(value: unknown, allowed: string[]) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    throw new GroupCallError("calls.group_invalid_request", 400);
}
export function registerGroupCallRoutes(
  app: FastifyInstance,
  service: GroupCallService,
): void {
  app.post(
    "/v1/calls/groups",
    {
      preValidation: async (r) => keys(r.body, ["requestId", "characterIds"]),
      schema: {
        body: Type.Object(
          {
            requestId: Type.String({ minLength: 1, maxLength: 128 }),
            characterIds: Type.Array(text, {
              minItems: 2,
              maxItems: 4,
              uniqueItems: true,
            }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (r) => ({
      group: await service.create({
        ...(r.body as { requestId: string; characterIds: string[] }),
        ...(r.headers.authorization
          ? { authorizationHeader: r.headers.authorization }
          : {}),
      }),
    }),
  );
  app.get(
    "/v1/calls/groups/:groupId",
    { schema: { params: groupParams } },
    async (r) => ({
      group: await service.get({
        ...(r.params as { groupId: string }),
        ...(r.headers.authorization
          ? { authorizationHeader: r.headers.authorization }
          : {}),
      }),
    }),
  );
  app.post(
    "/v1/calls/groups/:groupId/participants/:characterId/token",
    {
      preValidation: async (r) => keys(r.body, ["admissionId"]),
      schema: {
        params: memberParams,
        body: Type.Object(
          { admissionId: Type.Optional(text) },
          { additionalProperties: false },
        ),
      },
    },
    async (r) =>
      service.token({
        ...(r.params as { groupId: string; characterId: string }),
        ...(r.body as { admissionId?: string }),
        ...(r.headers.authorization
          ? { authorizationHeader: r.headers.authorization }
          : {}),
      }),
  );
  app.delete(
    "/v1/calls/groups/:groupId/participants/:characterId",
    { schema: { params: memberParams } },
    async (r) => ({
      group: await service.remove({
        ...(r.params as { groupId: string; characterId: string }),
        ...(r.headers.authorization
          ? { authorizationHeader: r.headers.authorization }
          : {}),
      }),
    }),
  );
  app.post(
    "/v1/calls/groups/:groupId/end",
    {
      preValidation: async (r) => keys(r.body, []),
      schema: {
        params: groupParams,
        body: Type.Object({}, { additionalProperties: false }),
      },
    },
    async (r) => ({
      group: await service.end({
        ...(r.params as { groupId: string }),
        ...(r.headers.authorization
          ? { authorizationHeader: r.headers.authorization }
          : {}),
      }),
    }),
  );
}
