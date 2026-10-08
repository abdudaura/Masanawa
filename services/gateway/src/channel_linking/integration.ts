import type { FastifyInstance } from "fastify";
import type {
  CustomerChannelRepository,
  PlatformSessionRepository,
} from "@masanawa/security";
import type {
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import { createPlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import type { CustomerChannelBridge } from "../customer_channel_bridge.js";
import { createChannelDefaultAgentResolver } from "./default_agent.js";
import { createLinkingAwareChannelBridge } from "./provider_bridge.js";
import { createPostgresLinkRepository, type LinkSqlPool } from "./postgres_repository.js";
import { registerLinkedChannelsRoutes } from "./routes.js";
import { createLinkingService, type LinkChannel } from "./service.js";

/**
 * Standalone composition seam for F08/F12. Does NOT register itself on global
 * Gateway, patch R15 webhooks, or start migrations behind the owner's back.
 */
export function createCustomerChannelLinkingComposition(input: Readonly<{
  pool: LinkSqlPool;
  sessions: PlatformSessionRepository;
  canonicalChannels: CustomerChannelRepository;
  assistantBridge: CustomerChannelBridge;
  profiles: PlatformAgentProfileRepository;
  preferences?: UserAgentPreferenceRepository;
  /** Provider-owned verified public bot number/username. No secrets or tokens. */
  destinations: Partial<Record<LinkChannel, string>>;
}>): Readonly<{
  bridge: CustomerChannelBridge;
  registerRoutes(app: FastifyInstance): void;
}> {
  const repository = createPostgresLinkRepository(input.pool);
  const service = createLinkingService({
    repository,
    destinations: input.destinations,
    resolveDefaultCharacter: createChannelDefaultAgentResolver({
      profiles: input.profiles,
      ...(input.preferences ? { preferences: input.preferences } : {}),
    }),
  });
  const bridge = createLinkingAwareChannelBridge({
    assistant: input.assistantBridge,
    channels: input.canonicalChannels,
    linking: service,
    repository,
  });
  const authorize = createPlatformCustomerSessionAuthorizer({
    repository: input.sessions,
  });
  return Object.freeze({
    bridge,
    registerRoutes(app) {
      registerLinkedChannelsRoutes(app, { service, authorize });
    },
  });
}

