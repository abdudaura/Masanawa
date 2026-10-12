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
}): MobilePushSender {
  const credentials = serviceAccount(input.serviceAccountJson);
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  let cached: { token: string; expiresAt: number } | undefined;

  async function accessToken(signal: AbortSignal): Promise<string> {
    const current = now().getTime();
    if (cached && cached.expiresAt - 60_000 > current) return cached.token;
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
    const response = await fetchImpl(credentials.token_uri!, {
      signal,
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new Error("Firebase OAuth failed");
    const payload = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof payload.access_token !== "string") {
      throw new Error("Firebase OAuth returned no token");
    }
    const expires =
      typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    cached = {
      token: payload.access_token,
      expiresAt: current + Math.max(60, expires) * 1000,
    };
    return cached.token;
  }

  const sender: MobilePushSender = {
    async send(request) {
      const registrations = await input.repository.list(request.scope);
      if (registrations.length === 0) {
        return Object.freeze({ attempted: 0, delivered: 0 });
      }
      const signal = AbortSignal.timeout(10_000);
      const bearer = await accessToken(signal);
      let delivered = 0;
      for (const registration of registrations) {
        const response = await fetchImpl(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
            credentials.project_id,
          )}/messages:send`,
          {
            method: "POST",
            signal,
            headers: {
              authorization: `Bearer ${bearer}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
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
            }),
          },
        );
        if (response.ok) delivered += 1;
      }
      return Object.freeze({
        attempted: registrations.length,
        delivered,
      });
    },
  };
  return Object.freeze(sender);
}
