interface FollowReadPool {
  query(sql:string,parameters:string[]):Promise<{rows:Array<{allowed:boolean}>}>;
}

/** Check at delivery time, not just at event enqueue. Fail-closed on DB error.
 * Existing events.outbox and the platform notifications worker remain the only
 * delivery authorities. This is a required policy adapter, not a second queue.
 */
export async function mayNotifyFollower(
  db:FollowReadPool,
  input:{tenantId:string;fanId:string;characterId:string}
):Promise<boolean> {
  try {
    const r=await db.query<{allowed:boolean}>([
      "SELECT EXISTS(",
      "SELECT 1 FROM masana.follows f",
      "JOIN identity.users u ON u.tenant_id=f.tenant_id AND u.user_id=f.fan_user_id AND u.state='active'",
      "JOIN masana.character_revisions r ON r.tenant_id=f.tenant_id",
      " AND r.character_id=f.character_id AND r.state='approved'",
      "JOIN identity.characters c ON c.tenant_id=f.tenant_id",
      " AND c.character_id=f.character_id AND c.state='active'",
      "JOIN identity.character_ownership o ON o.tenant_id=f.tenant_id",
      " AND o.character_id=f.character_id AND o.kind='platform'",
      "LEFT JOIN masana.follow_preferences p ON p.tenant_id=f.tenant_id",
      " AND p.fan_user_id=f.fan_user_id AND p.character_id=f.character_id",
      "WHERE f.tenant_id=$1 AND f.fan_user_id=$2 AND f.character_id=$3",
      " AND coalesce(p.muted,false)=false",
      ") AS allowed"
    ].join("\n"),[input.tenantId,input.fanId,input.characterId]);
    return r.rows[0]?.allowed===true;
  } catch {
    return false;
  }
}
