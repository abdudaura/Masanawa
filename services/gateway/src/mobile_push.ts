import { createSign } from "node:crypto";
import type {
  MobilePushRepository,
  MobileShellScope,
} from "@masanawa/agents";
import type { AgentConversationAuthorizer } from "./agent_conversation_contract.js";
import { parseCanonicalId } from "@masanawa/contracts";

export interface MobilePushRegistrationService {
  register(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly installationId: string;
    readonly platform: "android" | "ios";
    readonly token: string;
  }): Promise<{ readonly registered: true }>;
  unregister(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly installationId: string;
  }): Promise<{ readonly unregistered: true }>;
}

export interface MobilePushSender {
  send(input: {
    readonly scope: Pick<MobileShellScope, "tenantId" | "userId">;
    readonly title: string;
    readonly body: string;
    readonly data?: Readonly<Record<string, string>>;
  }): Promise<{ readonly attempted: number; readonly delivered: number }>;
}

export function createMobilePushRegistrationService(input: {
  readonly authorizer: AgentConversationAuthorizer;
  readonly repository: MobilePushRepository;
}): MobilePushRegistrationService {
  const service: MobilePushRegistrationService = {
    async register(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      });
      await input.repository.register({
        tenantId: admission.scope.tenantId,
        userId: admission.scope.userId,
        installationId: request.installationId,
        platform: request.platform,
        token: request.token,
      });
      return Object.freeze({ registered: true as const });
    },
    async unregister(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      });
      await input.repository.unregister({
        tenantId: admission.scope.tenantId,
        userId: admission.scope.userId,
        installationId: request.installationId,
      });
      return Object.freeze({ unregistered: true as const });
    },
  };
  return Object.freeze(service);
}

type ServiceAccount = {
  readonly project_id: string;
  readonly client_email: string;
  readonly private_key: string;
  readonly token_uri?: string;
};

function base64Url(value: string | Buffer): string {
  const data = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return data.toString("base64url");
}

function serviceAccount(raw: string): ServiceAccount {
  const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  if (
    typeof parsed.project_id !== "string" ||
    !parsed.project_id ||
    typeof parsed.client_email !== "string" ||
    !parsed.client_email ||
    typeof parsed.private_key !== "string" ||
    !parsed.private_key.includes("PRIVATE KEY")
  ) {
    throw new TypeError("Invalid Firebase service account");
  }
  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri:
      typeof parsed.token_uri === "string" && parsed.token_uri
        ? parsed.token_uri
        : "https://oauth2.googleapis.com/token",
  };
}

export function createFcmPushSender(input: {
  readonly serviceAccountJson: string;
  readonly repository: MobilePushRepository;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  /** Injected for deterministic tests; production uses bounded timer delays. */
  readonly wait?: (milliseconds: number) => Promise<void>;
}): MobilePushSender {
  const credentials = serviceAccount(input.serviceAccountJson);
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  const wait = input.wait ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let cached: { token: string; expiresAt: number } | undefined;
  let pendingToken: Promise<string> | undefined;

  // Coalesce concurrent sends for the same project. Expired/invalid credentials
  // are never reused after an OAuth rejection from FCM.
  async function accessToken(forceRefresh = false): Promise<string> {
    if (forceRefresh) cached = undefined;
    const current = now().getTime();
    if (cached && cached.expiresAt - 60_000 > current) return cached.token;
    if (pendingToken) return pendingToken;

    const refresh = async (): Promise<string> => {
      const issued = Math.floor(current / 1000);
      const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
      const claims = base64Url(
        JSON.stringify({
          iss: credentials.client_email,
          scope: "https://www.googleapis.com/auth/firebase.messaging",
          aud: credentials.token_uri,
          iat: issued,
          exp: issued + 3600,
        }),
      );
      const unsigned = `${header}.${claims}`;
      const signer = createSign("RSA-SHA256");
      signer.update(unsigned);
      signer.end();
      const assertion = `${unsigned}.${signer
        .sign(credentials.private_key)
        .toString("base64url")}`;
      let response: Response;
      try {
        response = await fetchImpl(credentials.token_uri!, {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion,
          }),
        });
      } catch {
        // A timed-out OAuth call cannot authorize a send. Never include
        // transport or service-account details in caller-visible errors.
        throw new Error("Firebase OAuth failed");
      }
      if (!response.ok) throw new Error("Firebase OAuth failed");
      const payload = (await response.json()) as {
        access_token?: unknown;
        expires_in?: unknown;
      };
      if (typeof payload.access_token !== "string" || !payload.access_token) {
        throw new Error("Firebase OAuth returned no token");
      }
      const expires =
        typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
          ? payload.expires_in
          : 3600;
      cached = {
        token: payload.access_token,
        expiresAt: current + Math.max(60, expires) * 1000,
      };
      return cached.token;
    };
    const promise = refresh();
    pendingToken = promise;
    try {
      return await promise;
    } finally {
      if (pendingToken === promise) pendingToken = undefined;
    }
  }

  // A definite 429/5xx rejection did not enqueue the message. A transport
  // exception is ambiguous: retrying it can duplicate a user notification.
  function retryable(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599);
  }

  const sender: MobilePushSender = {
    async send(request) {
      const registrations = await input.repository.list(request.scope);
      if (registrations.length === 0) {
        return Object.freeze({ attempted: 0, delivered: 0 });
      }
      let bearer = await accessToken();
      let delivered = 0;
      for (const registration of registrations) {
        const message = JSON.stringify({
          message: {
            token: registration.token,
            notification: {
              title: request.title.slice(0, 120),
              body: request.body.slice(0, 1000),
            },
            data: {
              ...(request.data ?? {}),
              masanawa: "1",
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "masanawa_work",
              },
            },
            apns: {
              payload: { aps: { sound: "default" } },
            },
          },
        });
        let refreshedAuth = false;
        let transientRetries = 0;
        while (true) {
          let response: Response;
          try {
            response = await fetchImpl(
              `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
                credentials.project_id,
              )}/messages:send`,
              {
                method: "POST",
                // A timeout after dispatch is ambiguous and must not be retried
                // as a new push. The catch below advances to the next device.
                signal: AbortSignal.timeout(15_000),
                headers: {
                  authorization: `Bearer ${bearer}`,
                  "content-type": "application/json",
                },
                body: message,
              },
            );
          } catch {
            // FCM may have accepted a request before the connection dropped.
            // Do not resend this token with a fresh message identity.
            break;
          }
          if (response.ok) {
            delivered += 1;
            break;
          }
          if (response.status === 401) {
            if (refreshedAuth) {
              // All further sends use these credentials: fail closed rather
              // than silently mark an entire batch as delivered.
              throw new Error("Firebase FCM rejected refreshed credentials");
            }
            bearer = await accessToken(true);
            refreshedAuth = true;
            continue;
          }
          if (retryable(response.status) && transientRetries < 2) {
            // Bounded backoff, total 250ms + 500ms per rejected token.
            await wait(250 * 2 ** transientRetries);
            transientRetries += 1;
            continue;
          }
          // 400/403/404 and exhausted transient failures are not successes.
          // A device token is not pruned without verifying the FCM error code
          // and exact tenant/user/installation identity.
          break;
        }
      }
      return Object.freeze({
        attempted: registrations.length,
        delivered,
      });
    },
  };
  return Object.freeze(sender);
}

