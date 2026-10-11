import type { Pool } from "pg";

/**
 * Read-only, tenant-scoped qualification against the one canonical Masana
 * profile authority from L-MASANA (#630). Requires its additive schema to be
 * installed first; without it, PostgreSQL raises and admission fails closed.
 */
export function createPostgresMasanaChatEligibility(db: Pick<Pool, "query">) {
  return Object.freeze({
    async isApprovedPlatformMasana(input: {
      readonly tenantId: string;
      readonly characterId: string;
    }): Promise<boolean> {
      if (!input.tenantId || !input.characterId) return false;
      const result = await db.query<{ eligible: boolean }>(
        "SELECT EXISTS (" +
        " SELECT 1 FROM masana.character_revisions r" +
        " JOIN identity.characters c USING (tenant_id,character_id)" +
        " JOIN identity.character_ownership o USING (tenant_id,character_id)" +
        " WHERE r.tenant_id = $1 AND r.character_id = $2" +
        " AND r.state = 'approved' AND c.state = 'active'" +
        " AND o.kind = 'platform'" +
        ") AS eligible",
        [input.tenantId, input.characterId],
      );
      return result.rows[0]?.eligible === true;
    },
  });
}
