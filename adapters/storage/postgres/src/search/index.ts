import type { Pool } from "pg";
import type { SearchHit, SearchKind, SearchPage, SearchQuery, SearchStore } from
  "../../../../../services/gateway/src/modules/search/contract.js";

/** No separate search index, external search service, migration or user table. */
type ReadPool = Pick<Pool, "query">;
function escapeLike(s: string): string { return s.replace(/[%_\\]/g, "\\$&"); }
interface Row { id: string; title: string; subtitle: string; source_url?: string | null; }

/** Cursor and values are always bound; all four projections admit only public rows. */
function statement(kind: SearchKind): string {
  switch (kind) {
    case "masana":
      return "SELECT r.character_id AS id, r.profile->>'displayName' AS title, " +
        "r.profile->>'profession' AS subtitle " +
        "FROM masana.character_revisions r " +
        "JOIN identity.characters c USING(tenant_id,character_id) " +
        "JOIN identity.character_ownership o USING(tenant_id,character_id) " +
        "WHERE r.tenant_id=$1 AND r.state='approved' AND c.state='active' AND o.kind='platform' " +
        "AND (r.profile->>'displayName' ILIKE $2 OR r.profile->>'profession' ILIKE $2 " +
        "OR r.profile->>'handle' ILIKE $2) AND ($3::text IS NULL OR r.character_id > $3) " +
        "ORDER BY r.character_id ASC LIMIT $4";
    case "rooms":
      return "SELECT rm.room_id AS id, rm.profession_title AS title, " +
        "(rm.language || ' · ' || CASE WHEN rm.plan_mode='paid' THEN 'Paid Room' ELSE 'Free Room' END) AS subtitle " +
        "FROM rooms.rooms rm JOIN masana.character_revisions mr " +
        "ON mr.tenant_id=rm.tenant_id AND mr.character_id=rm.teacher_character_id AND mr.state='approved' " +
        "JOIN identity.characters c ON c.tenant_id=rm.tenant_id AND c.character_id=rm.teacher_character_id " +
        "JOIN identity.character_ownership o ON o.tenant_id=c.tenant_id AND o.character_id=c.character_id " +
        "WHERE rm.tenant_id=$1 AND rm.state='published' AND c.state='active' AND o.kind='platform' " +
        "AND (rm.profession_title ILIKE $2 OR rm.rules ILIKE $2) " +
        "AND ($3::text IS NULL OR rm.room_id > $3) " +
        "ORDER BY rm.room_id ASC LIMIT $4";
    case "posts":
      return "SELECT p.id::text AS id, left(p.body,120) AS title, " +
        "(mr.profile->>'displayName') AS subtitle " +
        "FROM feed.posts p JOIN masana.character_revisions mr " +
        "ON mr.tenant_id=p.tenant_id AND mr.character_id=p.author_masana_id AND mr.state='approved' " +
        "JOIN identity.characters c ON c.tenant_id=p.tenant_id AND c.character_id=p.author_masana_id " +
        "JOIN identity.character_ownership o ON o.tenant_id=c.tenant_id AND o.character_id=c.character_id " +
        "WHERE p.tenant_id=$1 AND p.state='published' AND c.state='active' AND o.kind='platform' " +
        "AND (p.body ILIKE $2 OR mr.profile->>'displayName' ILIKE $2) " +
        "AND ($3::text IS NULL OR p.id::text < $3) " +
        "ORDER BY p.id DESC LIMIT $4";
    case "videos":
      return "SELECT v.item_id::text AS id, v.title, " +
        "(v.channel_name || ' · ' || v.provider) AS subtitle, v.source_url " +
        "FROM external_videos.items v " +
        "WHERE v.tenant_id=$1 AND v.review_state='approved' AND v.verified_at IS NOT NULL " +
        "AND (v.title ILIKE $2 OR v.channel_name ILIKE $2) " +
        "AND ($3::text IS NULL OR v.item_id::text < $3) " +
        "ORDER BY v.item_id DESC LIMIT $4";
  }
}
export function createPostgresSearchStore(pool: ReadPool): SearchStore {
  return Object.freeze({
    async search(input: SearchQuery): Promise<SearchPage> {
      if (!input.tenantId || !input.q || input.limit < 1 || input.limit > 20)
        throw new TypeError("invalid_search_scope");
      const result = await pool.query<Row>(statement(input.kind),
        [input.tenantId, "%" + escapeLike(input.q) + "%", input.cursor, input.limit + 1]);
      const more = result.rows.length > input.limit;
      const rows = result.rows.slice(0, input.limit);
      const items: SearchHit[] = rows.map(row => ({
        kind: input.kind, id: row.id, title: row.title, subtitle: row.subtitle,
        ...(input.kind === "videos" && row.source_url ? { sourceUrl: row.source_url } : {}),
      }));
      return { items, nextCursor: more ? (items.at(-1)?.id ?? null) : null };
    },
  });
}
