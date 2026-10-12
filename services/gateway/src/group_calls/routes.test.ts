import { createGatewayApp } from "../app.js";
import { it, expect, vi } from "vitest";
import { registerGroupCallRoutes } from "./routes.js";
import {
  createGroupCallService,
  GroupCallError,
  type GroupCallRepository,
} from "./service.js";
import type { AgentDirectoryAuthorizer } from "../agent_directory.js";
import type { LiveVoiceTokenService } from "../agent_shell_contract.js";
it("rejects injected authority and enforces admission gate before repository/provider", async () => {
  const repo = {
    create: vi.fn(),
    issue: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    end: vi.fn(),
  } as GroupCallRepository;
  const mint = vi.fn();
  const authorize = vi
    .fn()
    .mockResolvedValue({ tenantId: "tenant-a", userId: "user-a" });
  const service = createGroupCallService({
    repository: repo,
    authorizer: { authorize } as AgentDirectoryAuthorizer,
    liveVoiceTokens: { mint } as LiveVoiceTokenService,
    paidAdmissionConfigured: false,
  });
  const app = createGatewayApp({ groupCalls: service });
  const groupId = "0199a123-1234-7123-8123-123456789abc";
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/calls/groups",
        payload: { requestId: "r", characterIds: ["a", "b"], userId: "victim" },
      })
    ).statusCode,
  ).toBe(400);
  expect(repo.create).not.toHaveBeenCalled();
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/v1/calls/groups/${groupId}/participants/a/token`,
        payload: {},
      })
    ).statusCode,
  ).toBe(503);
  expect(mint).not.toHaveBeenCalled();
  expect(repo.issue).not.toHaveBeenCalled();
  await app.close();
});
it("canonicalizes request selection and propagates paid consent to existing token authority", async () => {
  const repo = {
    create: vi.fn().mockResolvedValue({}),
    issue: vi.fn(async (_s, mint) => mint()),
    get: vi.fn(),
    remove: vi.fn(),
    end: vi.fn(),
  } as GroupCallRepository;
  const mint = vi
    .fn()
    .mockRejectedValue(new GroupCallError("consent_required", 403));
  const service = createGroupCallService({
    repository: repo,
    authorizer: {
      authorize: vi.fn().mockResolvedValue({
        tenantId: "tenant-a",
        userId: "user-a",
        characterIds: ["a", "b"],
      }),
    } as AgentDirectoryAuthorizer,
    liveVoiceTokens: { mint },
    paidAdmissionConfigured: true,
  });
  await service.create({
    authorizationHeader: "Bearer actor",
    requestId: "r",
    characterIds: ["b", "a"],
  });
  expect(repo.create).toHaveBeenCalledWith({
    tenantId: "tenant-a",
    userId: "user-a",
    characterIds: ["a", "b"],
    requestId: "r",
    selected: ["a", "b"],
  });
  await expect(
    service.token({
      authorizationHeader: "Bearer actor",
      groupId: "0199a123-1234-7123-8123-123456789abc",
      characterId: "a",
      admissionId: "consent",
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(mint).toHaveBeenCalledWith({
    authorizationHeader: "Bearer actor",
    characterId: "a",
    admissionId: "consent",
  });
});

it("real Gateway rejects unauthenticated group reads before storage", async () => {
  const repo = {
    create: vi.fn(),
    issue: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    end: vi.fn(),
  } as GroupCallRepository;
  const authorizer = {
    authorize: vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("unauthorized"), { statusCode: 401 }),
      ),
  } as AgentDirectoryAuthorizer;
  const service = createGroupCallService({
    repository: repo,
    authorizer,
    liveVoiceTokens: { mint: vi.fn() },
    paidAdmissionConfigured: true,
  });
  const app = createGatewayApp({ groupCalls: service });
  try {
    expect(
      (
        await app.inject({
          url: "/v1/calls/groups/0199a123-1234-7123-8123-123456789abc",
        })
      ).statusCode,
    ).toBe(401);
    expect(repo.get).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
it("strict admission validates authenticated actor and fails closed for missing or forged consent", async () => {
  const mint = vi.fn();
  const authorize = vi
    .fn()
    .mockResolvedValue({ tenantId: "tenant-a", userId: "user-a" });
  const repo = {
    create: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    end: vi.fn(),
    issue: vi.fn(async (_scope, issue, validate) => {
      await validate!({ supportAgent: false });
      return issue();
    }),
  } as GroupCallRepository;
  const request = {
    groupId: "0199a123-1234-7123-8123-123456789abc",
    characterId: "a",
    admissionId: "wrong-account-consent",
  };
  const missing = createGroupCallService({
    repository: repo,
    authorizer: { authorize },
    liveVoiceTokens: { mint },
    paidAdmissionConfigured: true,
  });
  await expect(missing.token(request)).rejects.toMatchObject({
    statusCode: 503,
  });
  expect(mint).not.toHaveBeenCalled();
  const validateAdmission = vi
    .fn()
    .mockRejectedValue(new GroupCallError("calls.admission_forbidden", 403));
  const service = createGroupCallService({
    repository: repo,
    authorizer: { authorize },
    liveVoiceTokens: { mint },
    paidAdmissionConfigured: true,
    validateAdmission,
  });
  await expect(service.token(request)).rejects.toMatchObject({
    statusCode: 403,
  });
  expect(validateAdmission).toHaveBeenCalledWith({
    tenantId: "tenant-a",
    userId: "user-a",
    characterId: "a",
    admissionId: "wrong-account-consent",
  });
  expect(mint).not.toHaveBeenCalled();
});
