import { createHmac, randomUUID } from "node:crypto";
import { createOtpCode } from "@masanawa/security";
import type {
  AccountDeletionChallengeRepository,
  AccountDeletionRepository,
  AccountDeletionRequest,
} from "@masanawa/identity";
import { CustomerAuthError, type PlatformCustomerSessionAuthorizer } from "./customer_auth.js";

export class AccountDeletionError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "AccountDeletionError";
  }
}

export interface DeletionCodeSender {
  send(input: Readonly<{ destination: string; code: string }>): Promise<void>;
}

export type PublicAccountDeletionStatus = Pick<
  AccountDeletionRequest,
  "requestId" | "phase" | "revision" | "createdAt" | "updatedAt"
>;

function publicStatus(request: AccountDeletionRequest): PublicAccountDeletionStatus {
  return Object.freeze({
    requestId: request.requestId,
    phase: request.phase,
    revision: request.revision,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  });
}

export interface AccountDeletionService {
  status(authorizationHeader: string | undefined): Promise<PublicAccountDeletionStatus | null>;
  request(authorizationHeader: string | undefined): Promise<Readonly<{
    request: PublicAccountDeletionStatus;
    verificationChannel: "email" | "sms" | null;
    verificationSent: boolean;
  }>>;
  verify(input: Readonly<{ authorizationHeader: string | undefined; code: string }>): Promise<PublicAccountDeletionStatus>;
}

function codeHash(input: Readonly<{
  pepper: string;
  tenantId: string;
  userId: string;
  requestId: string;
  code: string;
}>): string {
  return createHmac("sha256", input.pepper)
    .update(["masanawa", "account-deletion-v1", input.tenantId,
             input.userId, input.requestId, input.code].join("\0"), "utf8")
    .digest("hex");
}

function addSeconds(now: string, seconds: number): string {
  return new Date(Date.parse(now) + seconds * 1000).toISOString();
}

/**
 * Authenticated request intake and purpose-scoped OTP verification.
 * It NEVER revokes sessions, modifies balances or purges user data.
 * Only the independently qualified server cleanup worker can advance processing.
 */
export function createAccountDeletionService(input: Readonly<{
  sessions: PlatformCustomerSessionAuthorizer;
  requests: AccountDeletionRepository;
  challenges: AccountDeletionChallengeRepository;
  otpPepper: string;
  email?: DeletionCodeSender;
  sms?: DeletionCodeSender;
  now?: () => string;
}>): AccountDeletionService {
  if (input.otpPepper.length < 32) throw new TypeError("Account deletion pepper is invalid");
  const now = input.now ?? (() => new Date().toISOString());

  async function authenticate(header: string | undefined) {
    try {
      return await input.sessions.authorize({ authorizationHeader: header });
    } catch (error) {
      if (error instanceof CustomerAuthError && error.statusCode === 503) {
        throw new AccountDeletionError("AUTH_UNAVAILABLE", 503);
      }
      throw new AccountDeletionError("UNAUTHORIZED", 401);
    }
  }

  return Object.freeze<AccountDeletionService>({
    async status(header) {
      const identity = await authenticate(header);
      const request = await input.requests.read({ tenantId: identity.tenantId, userId: identity.userId });
      return request ? publicStatus(request) : null;
    },
    async request(header) {
      const identity = await authenticate(header);
      const at = now();
      const request = await input.requests.open({
        tenantId: identity.tenantId,
        userId: identity.userId,
        requestId: randomUUID(),
        now: at,
      });
      if (request.phase !== "requested" && request.phase !== "failed") {
        return { request: publicStatus(request), verificationChannel: null, verificationSent: false };
      }
      const delivery = identity.profile.email && input.email
        ? { channel: "email" as const, destination: identity.profile.email, sender: input.email }
        : identity.profile.phone && input.sms
          ? { channel: "sms" as const, destination: identity.profile.phone, sender: input.sms }
          : null;
      if (!delivery) {
        return { request: publicStatus(request), verificationChannel: null, verificationSent: false };
      }
      const otp = createOtpCode();
      const digest = codeHash({
        pepper: input.otpPepper,
        tenantId: identity.tenantId,
        userId: identity.userId,
        requestId: request.requestId,
        code: otp,
      });
      try {
        await input.challenges.put({
          tenantId: identity.tenantId,
          userId: identity.userId,
          requestId: request.requestId,
          codeHash: digest,
          channel: delivery.channel,
          now: at,
          expiresAt: addSeconds(at, 600),
          resendAfter: addSeconds(at, 60),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "account_deletion.challenge_cooldown") {
          throw new AccountDeletionError("ACCOUNT_DELETION_CODE_RATE_LIMITED", 429);
        }
        throw error;
      }
      try {
        await delivery.sender.send({ destination: delivery.destination, code: otp });
      } catch {
        await input.challenges.cancel({
          tenantId: identity.tenantId, userId: identity.userId, codeHash: digest,
        }).catch(() => undefined);
        throw new AccountDeletionError("ACCOUNT_DELETION_DELIVERY_UNAVAILABLE", 503);
      }
      return { request: publicStatus(request), verificationChannel: delivery.channel, verificationSent: true };
    },
    async verify({ authorizationHeader, code }) {
      const identity = await authenticate(authorizationHeader);
      if (!/^\d{6}$/u.test(code)) {
        throw new AccountDeletionError("ACCOUNT_DELETION_CODE_INVALID", 400);
      }
      const request = await input.requests.read({
        tenantId: identity.tenantId, userId: identity.userId,
      });
      if (!request) throw new AccountDeletionError("ACCOUNT_DELETION_NOT_FOUND", 404);
      if (request.phase !== "requested") {
        throw new AccountDeletionError("ACCOUNT_DELETION_ALREADY_VERIFIED", 409);
      }
      const at = now();
      const outcome = await input.challenges.verify({
        tenantId: identity.tenantId,
        userId: identity.userId,
        requestId: request.requestId,
        expectedRevision: request.revision,
        codeHash: codeHash({
          pepper: input.otpPepper,
          tenantId: identity.tenantId,
          userId: identity.userId,
          requestId: request.requestId,
          code,
        }),
        now: at,
      });
      if (outcome.result === "accepted") {
        return publicStatus(outcome.request);
      }
      throw new AccountDeletionError(
        outcome.result === "already-verified" ? "ACCOUNT_DELETION_ALREADY_VERIFIED" :
        outcome.result === "conflict" ? "ACCOUNT_DELETION_STATE_CONFLICT" :
        outcome.result === "locked" ? "ACCOUNT_DELETION_CODE_LOCKED" :
        outcome.result === "expired" ? "ACCOUNT_DELETION_CODE_EXPIRED" :
        "ACCOUNT_DELETION_CODE_INVALID",
        outcome.result === "already-verified" || outcome.result === "conflict"
          ? 409 : outcome.result === "locked" ? 429 : 400,
      );
    },
  });
}

export function createResendAccountDeletionSender(input: Readonly<{
  apiKey: string; from: string; fetchImpl?: typeof fetch;
}>): DeletionCodeSender {
  if (!input.apiKey.trim() || !input.from.trim()) throw new TypeError("Email delivery is not configured");
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async send({ destination, code }) {
      const message = `Use code ${code} to verify your Masanawa account deletion request. It expires in 10 minutes. If you did not request deletion, do not share this code.`;
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: input.from, to: [destination],
          subject: "Verify your Masanawa account deletion request",
          text: message,
          tags: [{ name: "category", value: "account_deletion_verification" }],
        }),
      });
      if (!response.ok) throw new Error("account_deletion.email_unavailable");
    },
  };
}

export function createHttpAccountDeletionSmsSender(input: Readonly<{
  endpoint: string; bearerToken: string; fetchImpl?: typeof fetch;
}>): DeletionCodeSender {
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== "https:" || !input.bearerToken.trim()) {
    throw new TypeError("SMS delivery is not configured securely");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async send({ destination, code }) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.bearerToken}`, "content-type": "application/json",
        },
        body: JSON.stringify({
          to: destination,
          message: `Masanawa account deletion verification: ${code}. Expires in 10 minutes. Do not share this code.`,
        }),
      });
      if (!response.ok) throw new Error("account_deletion.sms_unavailable");
    },
  };
}
