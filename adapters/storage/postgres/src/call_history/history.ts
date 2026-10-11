import type {Pool} from "pg";
import type {HistoryEntry,HistoryPage,HistoryState} from "../../../../../services/gateway/src/modules/call_history/policy.js";
import {makeHistoryCursor} from "../../../../../services/gateway/src/modules/call_history/policy.js";

interface HistoryScope {tenantId:string;fanUserId:string;}
type Row={
 callId:string;characterId:string;displayName:string|null;state:HistoryState;
 createdAt:Date|string;startedAt:Date|string|null;endedAt:Date|string|null;
 durationSeconds:number;
};
const iso=(v:Date|string|null):string|null =>
 v==null?null:(v instanceof Date?v:new Date(v)).toISOString();
/** Read-only J04 call_sessions projection. No parallel call/ledger/provider authority.
 * Pg SQL uses server-derived tenant+fan bindings and keyset pagination.
 */
export function createPostgresCallHistoryReader(db:Pick<Pool,"query">){
 return Object.freeze({
  async list(scope:HistoryScope,options:{limit:number;cursor:{createdAt:string;callId:string}|null}):Promise<HistoryPage>{
   if(!scope.tenantId||!scope.fanUserId||!Number.isInteger(options.limit) ||
       options.limit<1||options.limit>30)throw new TypeError("invalid_history_scope");
   const result=await db.query<Row>([
     'SELECT c.call_id AS "callId",c.character_id AS "characterId",',
     'c.state,c.created_at AS "createdAt",c.started_at AS "startedAt",',
     'c.ended_at AS "endedAt",c.billed_seconds AS "durationSeconds",',
     "COALESCE((SELECT r.profile->>'displayName' FROM masana.character_revisions r",
     "WHERE r.tenant_id=c.tenant_id AND r.character_id=c.character_id",
     "AND r.state IN ('approved','retired') ORDER BY",
     "CASE WHEN r.state='approved' THEN 0 ELSE 1 END,r.revision DESC LIMIT 1),",
     '\'Masanawa professional\') AS "displayName"',
     "FROM masana.call_sessions c",
     "WHERE c.tenant_id=$1 AND c.fan_user_id=$2",
     "AND ($3::timestamptz IS NULL OR (c.created_at,c.call_id)<($3::timestamptz,$4::text))",
     "ORDER BY c.created_at DESC,c.call_id DESC LIMIT $5",
   ].join(" "),[
     scope.tenantId,scope.fanUserId,options.cursor?.createdAt??null,
     options.cursor?.callId??null,options.limit+1,
   ]);
   const hasMore=result.rows.length>options.limit;
   const page=result.rows.slice(0,options.limit);
   const items:HistoryEntry[]=page.map(r=>({
     callId:r.callId,characterId:r.characterId,
     displayName:(r.displayName||"Masanawa professional").slice(0,100),
     state:r.state,createdAt:iso(r.createdAt)!,
     startedAt:iso(r.startedAt),endedAt:iso(r.endedAt),
     durationSeconds:Math.max(0,Math.min(900,Number(r.durationSeconds)||0)),
   }));
   const last=items[items.length-1];
   return {schemaVersion:1,items,nextCursor:hasMore&&last?
     makeHistoryCursor(last.createdAt,last.callId):null};
  },
 });
}
