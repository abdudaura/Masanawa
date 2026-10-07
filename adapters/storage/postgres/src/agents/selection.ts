import { PlatformError, parseCanonicalId, toInstant } from "@masanawa/contracts";
import { createAgentSkillSelector, normalizeAgentRun, normalizeCharacterSession, normalizeCharacterSkillAssignment,
  type AgentSkillSelectionAdmission } from "@masanawa/agents";
import { canonicalJson, createAuthorityContext } from "@masanawa/security";
import { createSkillSelectionSource } from "@masanawa/skills";
import type { ToolRegistry } from "@masanawa/tools";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";
import { readPostgresSkillRegistryForSelection } from "../skills/selection.js";
import { readPostgresCharacterSessionForContext } from "./sessions.js";
import { readPostgresAgentRunForContext } from "./runs.js";

export function createPostgresAgentSkillSelectionAdmission(pool: Pool, tools: ToolRegistry): AgentSkillSelectionAdmission {
  return Object.freeze({
    async prepare(raw: Parameters<AgentSkillSelectionAdmission["prepare"]>[0]) {
      const session=normalizeCharacterSession(raw.session), run=normalizeAgentRun(raw.run);
      const skillVersionId=parseCanonicalId("skill-version",raw.skillVersionId);
      if (!Array.isArray(raw.tools) || raw.tools.length>64) throw new RangeError("Too many selected Tool references");
      const selectedTools=Object.freeze(raw.tools.map(value=>Object.freeze({...value})));
      const authority=Object.freeze({...createAuthorityContext(raw.authority),
        authorityContextId:parseCanonicalId("authority-context",raw.authority.authorityContextId),
        principal:Object.freeze({...raw.authority.principal}),issuedAt:toInstant(raw.authority.issuedAt),
        ...(raw.authority.expiresAt?{expiresAt:toInstant(raw.authority.expiresAt)}:{})});
      if (!authority.capabilities.includes("agents.skill.select")) throw new PlatformError({
        code:"agents.selection_capability_missing",category:"authorization",message:"Agent Skill selection capability is required.",retryable:false});
      const scope={tenantId:session.tenantId,userId:session.userId,characterId:session.characterId,relationshipId:session.relationshipId};
      return withTransaction(pool,async client=>{
        const currentSession=await readPostgresCharacterSessionForContext(client,{authority,scope,characterSessionId:session.characterSessionId});
        const currentRun=await readPostgresAgentRunForContext(client,{authority,scope,agentRunId:run.agentRunId});
        if(canonicalJson(session)!==canonicalJson(currentSession)||canonicalJson(run)!==canonicalJson(currentRun)) throw new PlatformError({
          code:"agents.selection_snapshot_changed",category:"conflict",message:"Character interaction changed before Skill selection admission.",retryable:false});
        const result=await client.query<{schema_version:1;tenant_id:string;character_id:string;skill_version_ids:unknown;revision:string}>(
          "SELECT * FROM agents.character_skill_assignments WHERE tenant_id = $1 AND character_id = $2 FOR SHARE",[scope.tenantId,scope.characterId]);
        const row=result.rows[0];
        if(!row) throw new PlatformError({code:"agents.selection_assignment_missing",category:"authorization",message:"Character Skill assignment is unavailable.",retryable:false});
        const assignment=normalizeCharacterSkillAssignment({schemaVersion:row.schema_version,tenantId:parseCanonicalId("tenant",row.tenant_id),
          characterId:parseCanonicalId("character",row.character_id),skillVersionIds:row.skill_version_ids as typeof session.bindings.skillVersionIds,revision:Number(row.revision)});
        if(!assignment.skillVersionIds.includes(skillVersionId)||!session.bindings.skillVersionIds.includes(skillVersionId)) throw new PlatformError({
          code:"agents.selection_binding_mismatch",category:"authorization",message:"Skill is outside the Character assignment or session selection.",retryable:false});
        const registry=await readPostgresSkillRegistryForSelection(client,skillVersionId);
        let at=toInstant((await client.query<{at:Date}>("SELECT clock_timestamp() AS at")).rows[0]!.at);
        const source=createPostgresCurrentAuthoritySource(client);
        const currentAuthority={async getPolicyRevision(tenantId:typeof scope.tenantId){
          const revision=await source.getPolicyRevision(tenantId);
          at=toInstant((await client.query<{at:Date}>("SELECT clock_timestamp() AS at")).rows[0]!.at);return revision;
        },async isRevoked(context:typeof authority){const revoked=await source.isRevoked!(context);
          at=toInstant((await client.query<{at:Date}>("SELECT clock_timestamp() AS at")).rows[0]!.at);return revoked;}};
        return createAgentSkillSelector({skills:createSkillSelectionSource(registry,tools),currentAuthority,now:()=>at})
          .prepare({authority,session:currentSession,run:currentRun,assignment,skillVersionId,tools:selectedTools});
      },{isolation:"repeatable read"});
    },
  });
}

