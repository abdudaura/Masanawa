import type {
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import { LinkError, type LinkIdentity } from "./service.js";

/** Reuse the real admin-managed Gwani/Gwana support roster and owner preference. */
export function createChannelDefaultAgentResolver(input: Readonly<{
  profiles: PlatformAgentProfileRepository;
  preferences?: UserAgentPreferenceRepository;
}>): (owner: LinkIdentity) => Promise<string> {
  return async (owner) => {
    const support = await input.profiles.listSupportAgents({
      tenantId: owner.tenantId as never,
    });
    const selected = await input.preferences?.readForUser({
      tenantId: owner.tenantId as never,
      userId: owner.userId as never,
    });
    if (selected) {
      const active = await input.profiles.readForCharacter({
        tenantId: owner.tenantId as never,
        characterId: selected.defaultPlatformCharacterId,
      });
      if (active?.supportAgent && active.tenantId === owner.tenantId &&
          support.some((entry) => entry.characterId === active.characterId)) {
        return active.characterId;
      }
    }
    const chosen = support.find((item) => item.defaultForNewUsers) ?? support[0];
    if (!chosen) throw new LinkError("CHANNEL_UNAVAILABLE", 503);
    return chosen.characterId;
  };
}
