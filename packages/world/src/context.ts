import type { CharacterId, CharacterVersionId, Instant, TenantId, WorldId } from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type { WorldEvent } from "./model.js";

export const worldContextReadCapability = "world.context.read";

/** World owns approved public evidence; Agents owns only transient composition. */
export interface PublicWorldContextReader {
  readEvents(input: {
    readonly authority: AuthorityContext;
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly characterVersionId: CharacterVersionId;
    readonly worldIds: readonly WorldId[];
    readonly at: Instant;
  }): Promise<readonly WorldEvent[]>;
}
