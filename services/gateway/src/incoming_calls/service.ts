import type { AgentDirectoryAuthorizer } from "../agent_directory.js";
import type { LiveVoiceTokenService } from "../agent_shell_contract.js";
import type { MobilePushSender } from "../mobile_push.js";
import type { CallScope } from "../call_history/service.js";
export type IncomingState =
  | "ringing"
  | "accepted"
  | "declined"
  | "cancelled"
  | "missed";
export interface IncomingCall {
  callId: string;
  characterId: string;
  displayName: string;
  state: IncomingState;
  createdAt: string;
  expiresAt: string;
}
export interface InitiateInput {
  tenantId: string;
  userId: string;
  characterId: string;
  requestId: string;
  ringDurationMs?: number;
}
export interface IncomingRepository {
  initiate(input: InitiateInput): Promise<IncomingCall>;
  get(input: CallScope & { callId: string }): Promise<IncomingCall | null>;
  list(input: CallScope): Promise<readonly IncomingCall[]>;
  transition(
    input: CallScope & {
      callId: string;
      state: "accepted" | "declined" | "cancelled";
    },
  ): Promise<IncomingCall | null>;
  expire(): Promise<void>;
  claimPush(): Promise<{
    tenantId: string;
    userId: string;
    call: IncomingCall;
    leaseId: string;
  } | null>;
  finishPush(input: {
    callId: string;
    leaseId: string;
    delivered: boolean;
  }): Promise<void>;
  claimToken(
    input: CallScope & { callId: string; admissionId: string },
  ): Promise<boolean>;
  finishToken(
    input: CallScope & { callId: string; success: boolean; unknown?: boolean },
  ): Promise<void>;
}
export class IncomingCallError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function validateId(callId: string) {
  if (!uuid.test(callId))
    throw new IncomingCallError("incoming.id_invalid", 400);
  return callId;
}
export function createIncomingCallService(input: {
  repository: IncomingRepository;
  authorizer: AgentDirectoryAuthorizer;
  serverAuthorizer: {
    authorize(input: {
      authorizationHeader: string | undefined;
      tenantId: string;
      characterId: string;
    }): Promise<void>;
  };
  liveVoiceTokens: LiveVoiceTokenService;
  pushSender?: MobilePushSender;
}) {
  async function scope(
    authorizationHeader: string | undefined,
  ): Promise<CallScope> {
    const a = await input.authorizer.authorize({
      authorizationHeader,
      capability: "agents.directory.read",
    });
    return {
      tenantId: a.tenantId,
      userId: a.userId,
      characterIds: a.characterIds ?? null,
    };
  }
  async function get(request: {
    authorizationHeader?: string;
    callId: string;
  }) {
    const actor = await scope(request.authorizationHeader);
    const call = await input.repository.get({
      ...actor,
      callId: validateId(request.callId),
    });
    if (!call) throw new IncomingCallError("incoming.not_found", 404);
    return { actor, call };
  }
  return Object.freeze({
    async initiate(request: InitiateInput & { authorizationHeader?: string }) {
      await input.serverAuthorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        tenantId: request.tenantId,
        characterId: request.characterId,
      });
      if (
        !request.requestId ||
        request.requestId.length > 128 ||
        !request.tenantId ||
        !request.userId ||
        !request.characterId
      )
        throw new IncomingCallError("incoming.invalid_request", 400);
      const duration = request.ringDurationMs ?? 60_000;
      if (
        !Number.isSafeInteger(duration) ||
        duration < 1000 ||
        duration > 120_000
      )
        throw new IncomingCallError("incoming.duration_invalid", 400);
      return input.repository.initiate({
        ...request,
        ringDurationMs: duration,
      });
    },
    async cancel(request: {
      authorizationHeader?: string;
      tenantId: string;
      userId: string;
      characterId: string;
      callId: string;
    }) {
      await input.serverAuthorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        tenantId: request.tenantId,
        characterId: request.characterId,
      });
      const call = await input.repository.transition({
        tenantId: request.tenantId,
        userId: request.userId,
        characterIds: [request.characterId],
        callId: validateId(request.callId),
        state: "cancelled",
      });
      if (!call) throw new IncomingCallError("incoming.not_found", 404);
      return call;
    },
    async list(request: { authorizationHeader?: string }) {
      return {
        calls: await input.repository.list(
          await scope(request.authorizationHeader),
        ),
      };
    },
    async get(request: { authorizationHeader?: string; callId: string }) {
      return (await get(request)).call;
    },
    async respond(request: {
      authorizationHeader?: string;
      callId: string;
      state: "accepted" | "declined";
    }) {
      const actor = await scope(request.authorizationHeader);
      const call = await input.repository.transition({
        ...actor,
        callId: validateId(request.callId),
        state: request.state,
      });
      if (!call) throw new IncomingCallError("incoming.not_found", 404);
      if (call.state !== request.state)
        throw new IncomingCallError("incoming.no_longer_ringing", 409);
      return call;
    },
    async token(request: {
      authorizationHeader?: string;
      callId: string;
      admissionId: string;
    }) {
      const { actor, call } = await get(request);
      if (call.state !== "accepted")
        throw new IncomingCallError("incoming.not_accepted", 409);
      if (!request.admissionId || request.admissionId.length > 160)
        throw new IncomingCallError("incoming.admission_invalid", 400);
      if (
        !(await input.repository.claimToken({
          ...actor,
          callId: call.callId,
          admissionId: request.admissionId,
        }))
      )
        throw new IncomingCallError("incoming.token_already_requested", 409);
      let mintSucceeded = false;
      try {
        const token = await input.liveVoiceTokens.mint({
          authorizationHeader: request.authorizationHeader,
          characterId: call.characterId,
          admissionId: request.admissionId,
          historyCallId: call.callId,
        });
        mintSucceeded = true;
        await input.repository.finishToken({
          ...actor,
          callId: call.callId,
          success: true,
        });
        return token;
      } catch (error) {
        await input.repository.finishToken({
          ...actor,
          callId: call.callId,
          success: false,
          unknown:
            mintSucceeded ||
            !!(
              error &&
              typeof error === "object" &&
              "issuanceUnknown" in error &&
              error.issuanceUnknown
            ),
        });
        throw error;
      }
    },
    async recover() {
      await input.repository.expire();
      if (!input.pushSender) return;
      for (let i = 0; i < 1; i++) {
        const job = await input.repository.claimPush();
        if (!job) break;
        let delivered = false;
        try {
          const result = await input.pushSender.send({
            scope: {
              tenantId: job.tenantId as never,
              userId: job.userId as never,
            },
            title: "Incoming Masana call",
            body: "Open Calls to respond",
            data: {
              type: "incoming_call",
              callId: job.call.callId,
              characterId: job.call.characterId,
              deepLink: "masanawa://calls/incoming/" + job.call.callId,
            },
          });
          delivered =
            result.attempted > 0 && result.attempted === result.delivered;
        } catch {
          /* durable retry */
        }
        await input.repository.finishPush({
          callId: job.call.callId,
          leaseId: job.leaseId,
          delivered,
        });
      }
    },
  });
}
export type IncomingCallService = ReturnType<typeof createIncomingCallService>;
