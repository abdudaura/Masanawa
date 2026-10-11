import type { Pool, PoolClient } from "pg";
import type { FanSetupProfile, FanSetupUpdate, FanInterest } from "@masanawa/identity";

export class FanSetupStoreError extends Error {
  constructor(readonly code: "fan_not_found" | "revision_conflict") { super(code); }
}
type Querier = Pick<Pool, "query">;
const projection = [
  "SELECT user_id, display_name, avatar_media_id, preferred_language, interests,",
  "age_attested_18plus_at, masana_disclosure_version, masana_disclosure_accepted_at,",
  "fan_setup_completed_at, revision FROM identity.users",
  "WHERE tenant_id=$1 AND user_id=$2 AND state='active'"
].join(" ");
function shape(row: Record<string, unknown>): FanSetupProfile {
  return {
    userId: String(row.user_id),
    displayName: row.display_name === null ? null : String(row.display_name),
    avatarMediaId: row.avatar_media_id === null ? null : String(row.avatar_media_id),
    preferredLanguage: row.preferred_language === "ha" ? "ha" : "en",
    interests: Array.isArray(row.interests) ? row.interests as FanInterest[] : [],
    ageAttested18Plus: row.age_attested_18plus_at != null,
    disclosureAccepted: row.masana_disclosure_accepted_at != null,
    disclosureVersion: row.masana_disclosure_version == null ? null : String(row.masana_disclosure_version),
    completed: row.fan_setup_completed_at != null,
    revision: Number(row.revision)
  };
}
async function get(client: Querier, tenantId: string, userId: string): Promise<FanSetupProfile | null> {
  const result = await client.query(projection, [tenantId,userId]);
  return result.rows[0] ? shape(result.rows[0] as Record<string,unknown>) : null;
}
export function createFanSetupStore(pool: Pool) {
  return {
    async read(input: {tenantId:string; userId:string}) {
      return get(pool,input.tenantId,input.userId);
    },
    async update(input: {tenantId:string; userId:string; update:FanSetupUpdate}) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("BEGIN");
        const {tenantId,userId,update} = input;
        const locked = await client.query(projection + " FOR UPDATE", [tenantId,userId]);
        if (!locked.rows[0]) throw new FanSetupStoreError("fan_not_found");
        const previous = shape(locked.rows[0] as Record<string,unknown>);
        const avatar = update.avatarMediaId === undefined
          ? previous.avatarMediaId : update.avatarMediaId;
        const same = previous.completed &&
          previous.displayName === update.displayName &&
          previous.preferredLanguage === update.preferredLanguage &&
          JSON.stringify(previous.interests) === JSON.stringify(update.interests) &&
          previous.avatarMediaId === avatar &&
          previous.ageAttested18Plus && previous.disclosureAccepted &&
          previous.disclosureVersion === update.disclosureVersion;
        // An identical retry after a lost HTTP response must not increment revision.
        if (same) {
          await client.query("COMMIT");
          return previous;
        }
        if (previous.revision !== update.expectedRevision)
          throw new FanSetupStoreError("revision_conflict");
        const next = await client.query([
          "UPDATE identity.users SET display_name=$3, avatar_media_id=$4,",
          "preferred_language=$5, interests=$6::text[],",
          "age_attested_18plus_at=COALESCE(age_attested_18plus_at,now()),",
          "masana_disclosure_version=$7,",
          "masana_disclosure_accepted_at=COALESCE(masana_disclosure_accepted_at,now()),",
          "fan_setup_completed_at=COALESCE(fan_setup_completed_at,now()),",
          "revision=revision+1, updated_at=now()",
          "WHERE tenant_id=$1 AND user_id=$2 AND revision=$8 AND state='active'",
          "RETURNING user_id, display_name, avatar_media_id, preferred_language, interests,",
          "age_attested_18plus_at, masana_disclosure_version, masana_disclosure_accepted_at,",
          "fan_setup_completed_at, revision"
        ].join(" "), [tenantId,userId,update.displayName,avatar,update.preferredLanguage,
          [...update.interests],update.disclosureVersion,update.expectedRevision]);
        if (!next.rows[0]) throw new FanSetupStoreError("revision_conflict");
        await client.query("COMMIT");
        return shape(next.rows[0] as Record<string,unknown>);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
