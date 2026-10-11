import type { Pool } from "pg";

export interface FollowingItem {
  characterId: string;
  revision: number;
  profile: Record<string, unknown>;
  followerCount: number;
  following: true;
  muted: boolean;
}
export interface FollowingPage {
  items: FollowingItem[];
  nextCursor: string | null;
}
export interface FollowingInput {
  tenantId: string;
  fanId: string;
  q: string;
  language: string;
  cursor: string | null;
  limit: number;
}
type Db = Pick<Pool, "query">;

/** One existing fan/character relationship. Never return other fans or drafts. */
export function createFollowingStore(db: Db) {
  return {
    async list(input: FollowingInput): Promise<FollowingPage> {
      const r = await db.query<{
        character_id: string; revision: number; profile: Record<string, unknown>;
        follower_count: string; muted: boolean
      }>(
        [
          "SELECT r.character_id,r.revision,r.profile,",
          "COALESCE(fc.follower_count,(SELECT count(*) FROM masana.follows ff",
          "  WHERE ff.tenant_id=f.tenant_id AND ff.character_id=f.character_id)) AS follower_count,",
          "COALESCE(pref.muted,false) AS muted",
          "FROM masana.follows f",
          "JOIN masana.character_revisions r ON r.tenant_id=f.tenant_id AND r.character_id=f.character_id AND r.state='approved'",
          "JOIN identity.characters c ON c.tenant_id=f.tenant_id AND c.character_id=f.character_id AND c.state='active'",
          "JOIN identity.character_ownership o ON o.tenant_id=f.tenant_id AND o.character_id=f.character_id AND o.kind='platform'",
          "LEFT JOIN masana.follow_counts fc ON fc.tenant_id=f.tenant_id AND fc.character_id=f.character_id",
          "LEFT JOIN masana.follow_preferences pref ON pref.tenant_id=f.tenant_id",
          "  AND pref.fan_user_id=f.fan_user_id AND pref.character_id=f.character_id",
          "WHERE f.tenant_id=$1 AND f.fan_user_id=$2",
          "AND ($3='' OR r.profile->>'displayName' ILIKE '%'||$3||'%'",
          "  OR r.profile->>'profession' ILIKE '%'||$3||'%'",
          "  OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(r.profile->'talents','[]'::jsonb)) AS interest",
          "    WHERE interest ILIKE '%'||$3||'%'))",
          "AND ($4='' OR r.profile->'languages' @> to_jsonb(ARRAY[$4]::text[]))",
          "AND ($5::text IS NULL OR f.character_id > $5)",
          "ORDER BY f.character_id ASC LIMIT $6"
        ].join("\n"),
        [input.tenantId,input.fanId,input.q,input.language,input.cursor,input.limit+1]
      );
      const more=r.rows.length>input.limit;
      const items=r.rows.slice(0,input.limit).map(row=>({
        characterId:row.character_id,revision:Number(row.revision),profile:row.profile,
        followerCount:Number(row.follower_count),following:true as const,muted:row.muted===true
      }));
      return {items,nextCursor:more?items[items.length-1]?.characterId??null:null};
    },
    async setMute(input: {tenantId:string;fanId:string;characterId:string;muted:boolean}): Promise<boolean|null> {
      // INSERT ... SELECT authorizes against the existing current Follow in the
      // same SQL statement as the write. A preflight SELECT would race unfollow.
      const r=await db.query<{muted:boolean}>([
        "INSERT INTO masana.follow_preferences(tenant_id,fan_user_id,character_id,muted)",
        "SELECT f.tenant_id,f.fan_user_id,f.character_id,$4",
        "FROM masana.follows f",
        "JOIN masana.character_revisions r ON r.tenant_id=f.tenant_id",
        "  AND r.character_id=f.character_id AND r.state='approved'",
        "JOIN identity.characters c ON c.tenant_id=f.tenant_id",
        "  AND c.character_id=f.character_id AND c.state='active'",
        "JOIN identity.character_ownership o ON o.tenant_id=f.tenant_id",
        "  AND o.character_id=f.character_id AND o.kind='platform'",
        "WHERE f.tenant_id=$1 AND f.fan_user_id=$2 AND f.character_id=$3",
        "ON CONFLICT(tenant_id,fan_user_id,character_id)",
        "DO UPDATE SET muted=EXCLUDED.muted,updated_at=now()",
        "RETURNING muted"
      ].join("\n"),[input.tenantId,input.fanId,input.characterId,input.muted]);
      return r.rows[0]?.muted??null;
    }
  };
}
