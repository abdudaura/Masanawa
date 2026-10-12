import type { AgentDirectoryAuthorizer } from "../agent_directory.js";
import type { LiveVoiceTokenService } from "../agent_shell_contract.js";
import type { CallScope } from "../call_history/service.js";
export class GroupCallError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}
export interface GroupCall {
  groupId: string;
  state: "connecting" | "active" | "ended";
  createdAt: string;
  endedAt: string | null;
  participants: {
    characterId: string;
    displayName: string;
    state: "selected" | "connecting" | "active" | "left" | "failed";
    callId: string | null;
  }[];
}
export type GroupScope = CallScope & { groupId: string };
export interface GroupCallRepository {
  create(
    input: CallScope & { requestId: string; selected: string[] },
  ): Promise<GroupCall>;
  get(input: GroupScope): Promise<GroupCall>;
  remove(input: GroupScope & { characterId: string }): Promise<GroupCall>;
  end(input: GroupScope): Promise<GroupCall>;
  issue<T extends { callId?: string }>(
    input: GroupScope & { characterId: string },
    mint: () => Promise<T>,
    validateParticipant?: (participant: {
      supportAgent: boolean;
    }) => Promise<void>,
  ): Promise<
    T & {
      groupId: string;
      characterId: string;
      displayName: string;
      callId: string;
    }
  >;
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export function createGroupCallService(input: {
  repository: GroupCallRepository;
  authorizer: AgentDirectoryAuthorizer;
  liveVoiceTokens: LiveVoiceTokenService;
  paidAdmissionConfigured: boolean;
  validateAdmission?: (input: {
    tenantId: string;
    userId: string;
    characterId: string;
    admissionId: string | null;
  }) => Promise<void>;
}) {
  async function scope(request: {
    authorizationHeader?: string;
    groupId?: string;
  }): Promise<CallScope> {
    const actor = await input.authorizer.authorize({
      authorizationHeader: request.authorizationHeader,
      capability: "agents.directory.read",
    });
    if (request.groupId !== undefined && !uuid.test(request.groupId))
      throw new GroupCallError("calls.group_id_invalid", 400);
    return {
      tenantId: actor.tenantId,
      userId: actor.userId,
      characterIds: actor.characterIds ?? null,
    };
  }
  return {
    async create(request: {
      authorizationHeader?: string;
      requestId: string;
      characterIds: string[];
    }) {
      const actor = await scope(request);
      if (
        typeof request.requestId !== "string" ||
        !/^[-A-Za-z0-9_:]{1,128}$/u.test(request.requestId) ||
        !Array.isArray(request.characterIds) ||
        request.characterIds.length < 2 ||
        request.characterIds.length > 4 ||
        request.characterIds.some(
          (id) => typeof id !== "string" || id.length < 1 || id.length > 200,
        ) ||
        new Set(request.characterIds).size !== request.characterIds.length
      )
        throw new GroupCallError("calls.group_invalid", 400);
      return input.repository.create({
        ...actor,
        requestId: request.requestId,
        selected: [...request.characterIds].sort(),
      });
    },
    async get(request: { authorizationHeader?: string; groupId: string }) {
      return input.repository.get({
        ...(await scope(request)),
        groupId: request.groupId,
      });
    },
    async remove(request: {
      authorizationHeader?: string;
      groupId: string;
      characterId: string;
    }) {
      return input.repository.remove({
        ...(await scope(request)),
        groupId: request.groupId,
        characterId: request.characterId,
      });
    },
    async end(request: { authorizationHeader?: string; groupId: string }) {
      return input.repository.end({
        ...(await scope(request)),
        groupId: request.groupId,
      });
    },
    async token(request: {
      authorizationHeader?: string;
      groupId: string;
      characterId: string;
      admissionId?: string;
    }) {
      const actor = await scope(request);
      if (!input.paidAdmissionConfigured)
        throw new GroupCallError("calls.paid_admission_unavailable", 503);
      return input.repository.issue(
        {
          ...actor,
          groupId: request.groupId,
          characterId: request.characterId,
        },
        () =>
          input.liveVoiceTokens.mint({
            authorizationHeader: request.authorizationHeader,
            characterId: request.characterId,
            ...(request.admissionId
              ? { admissionId: request.admissionId }
              : {}),
          }),
        async (participant) => {
          if (participant.supportAgent) return;
          if (!input.validateAdmission)
            throw new GroupCallError("calls.paid_admission_unavailable", 503);
          await input.validateAdmission({
            tenantId: actor.tenantId,
            userId: actor.userId,
            characterId: request.characterId,
            admissionId: request.admissionId ?? null,
          });
        },
      );
    },
  };
}
export type GroupCallService = ReturnType<typeof createGroupCallService>;
