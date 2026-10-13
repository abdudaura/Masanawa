import {
  normalizeAgentPresentation,
  normalizeCharacterSkillAssignment,
  normalizePlatformAgentProfile,
  normalizeUserAgentPreference,
  type AgentPresentation,
  type AgentPresentationRepository,
  type CharacterSkillAssignment,
  type CharacterSkillAssignmentRepository,
  type PlatformAgentProfile,
  type PlatformAgentProfileRepository,
  type UserAgentPreference,
  type UserAgentPreferenceRepository,
} from "@masanawa/agents";
import { PlatformError } from "@masanawa/contracts";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function assertExpectedRevision(value: number | null): void {
  if (
    value !== null &&
    (!Number.isSafeInteger(value) || value < 1 || value === Number.MAX_SAFE_INTEGER)
  ) {
    throw new RangeError("Expected revision is invalid or exhausted");
  }
}

interface PresentationRow {
  tenant_id: AgentPresentation["tenantId"];
  character_id: AgentPresentation["characterId"];
  character_version_id: AgentPresentation["characterVersionId"];
  schema_version: 1;
  display_name: string;
  role_label: string;
  about: string;
  greeting: string | null;
  visible_in_user_app: boolean;
  sort_order: number;
  revision: string;
}

interface PlatformProfileRow {
  tenant_id: PlatformAgentProfile["tenantId"];
  character_id: PlatformAgentProfile["characterId"];
  schema_version: 1;
  support_agent: boolean;
  default_for_new_users: boolean;
  voice_provider: string;
  voice_name: string;
  revision: string;
}
interface UserPreferenceRow {
  tenant_id: UserAgentPreference["tenantId"];
  user_id: UserAgentPreference["userId"];
  schema_version: 1;
  default_platform_character_id: UserAgentPreference["defaultPlatformCharacterId"];
  revision: string;
}
interface AssignmentRow {
  tenant_id: CharacterSkillAssignment["tenantId"];
  character_id: CharacterSkillAssignment["characterId"];
  schema_version: 1;
  skill_version_ids: unknown;
  revision: string;
}

function presentationFromRow(row: PresentationRow): AgentPresentation {
  return normalizeAgentPresentation({
    schemaVersion: row.schema_version,
    tenantId: row.tenant_id,
    characterId: row.character_id,
    characterVersionId: row.character_version_id,
    displayName: row.display_name,
    roleLabel: row.role_label,
    about: row.about,
    greeting: row.greeting,
    visibleInUserApp: row.visible_in_user_app,
    sortOrder: row.sort_order,
    revision: Number(row.revision),
  });
}

function platformProfileFromRow(row: PlatformProfileRow): PlatformAgentProfile {
  return normalizePlatformAgentProfile({
    schemaVersion: row.schema_version,
    tenantId: row.tenant_id,
    characterId: row.character_id,
    supportAgent: row.support_agent,
    defaultForNewUsers: row.default_for_new_users,
    voiceProvider: row.voice_provider,
    voiceName: row.voice_name,
    revision: Number(row.revision),
  });
}

function userPreferenceFromRow(row: UserPreferenceRow): UserAgentPreference {
  return normalizeUserAgentPreference({
    schemaVersion: row.schema_version,
    tenantId: row.tenant_id,
    userId: row.user_id,
    defaultPlatformCharacterId: row.default_platform_character_id,
    revision: Number(row.revision),
  });
}

function assignmentFromRow(row: AssignmentRow): CharacterSkillAssignment {
  if (!Array.isArray(row.skill_version_ids)) {
    throw conflict(
      "agents.skill_assignment_invalid",
      "Stored Character Skill assignment is invalid",
    );
  }
  return normalizeCharacterSkillAssignment({
    schemaVersion: row.schema_version,
    tenantId: row.tenant_id,
    characterId: row.character_id,
    skillVersionIds: row.skill_version_ids as CharacterSkillAssignment["skillVersionIds"],
    revision: Number(row.revision),
  });
}

export function createPostgresAgentPresentationRepository(
  pool: Pool,
): AgentPresentationRepository {
  return Object.freeze({
    async readForCharacter(
      input: Parameters<AgentPresentationRepository["readForCharacter"]>[0],
    ) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<PresentationRow>(
            `SELECT *
               FROM agents.agent_presentations
              WHERE tenant_id = $1 AND character_id = $2`,
            [input.tenantId, input.characterId],
          );
          return result.rows[0] ? presentationFromRow(result.rows[0]) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async listAll(
      input: Parameters<AgentPresentationRepository["listAll"]>[0],
    ) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<PresentationRow>(
            `SELECT *
               FROM agents.agent_presentations
              WHERE tenant_id = $1
              ORDER BY sort_order, character_id`,
            [input.tenantId],
          );
          return Object.freeze(result.rows.map(presentationFromRow));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async listVisible(
      input: Parameters<AgentPresentationRepository["listVisible"]>[0],
    ) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<PresentationRow>(
            `SELECT *
               FROM agents.agent_presentations
              WHERE tenant_id = $1 AND visible_in_user_app = true
              ORDER BY sort_order, character_id`,
            [input.tenantId],
          );
          return Object.freeze(result.rows.map(presentationFromRow));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async put(
      input: Parameters<AgentPresentationRepository["put"]>[0],
    ) {
      const presentation = normalizeAgentPresentation(input.presentation);
      assertExpectedRevision(input.expectedRevision);

      return withTransaction(pool, async (client) => {
        const values = [
          presentation.tenantId,
          presentation.characterId,
          presentation.characterVersionId,
          presentation.displayName,
          presentation.roleLabel,
          presentation.about,
          presentation.greeting,
          presentation.visibleInUserApp,
          presentation.sortOrder,
        ];

        const result =
          input.expectedRevision === null
            ? await client.query<PresentationRow>(
                `INSERT INTO agents.agent_presentations(
                   tenant_id, character_id, character_version_id, display_name,
                   role_label, about, greeting, visible_in_user_app, sort_order, revision
                 )
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)
                 ON CONFLICT DO NOTHING
                 RETURNING *`,
                values,
              )
            : await client.query<PresentationRow>(
                `UPDATE agents.agent_presentations
                    SET character_version_id = $3,
                        display_name = $4,
                        role_label = $5,
                        about = $6,
                        greeting = $7,
                        visible_in_user_app = $8,
                        sort_order = $9,
                        revision = revision + 1
                  WHERE tenant_id = $1
                    AND character_id = $2
                    AND revision = $10
                  RETURNING *`,
                [...values, input.expectedRevision],
              );

        if (!result.rows[0]) {
          throw conflict(
            "agents.presentation_revision_conflict",
            "Agent presentation changed since the supplied observation",
          );
        }
        return presentationFromRow(result.rows[0]);
      });
    },
  });
}

export function createPostgresCharacterSkillAssignmentRepository(
  pool: Pool,
): CharacterSkillAssignmentRepository {
  return Object.freeze({
    async readForCharacter(
      input: Parameters<CharacterSkillAssignmentRepository["readForCharacter"]>[0],
    ) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<AssignmentRow>(
            `SELECT *
               FROM agents.character_skill_assignments
              WHERE tenant_id = $1 AND character_id = $2`,
            [input.tenantId, input.characterId],
          );
          return result.rows[0] ? assignmentFromRow(result.rows[0]) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async put(
      input: Parameters<CharacterSkillAssignmentRepository["put"]>[0],
    ) {
      const assignment = normalizeCharacterSkillAssignment(input.assignment);
      assertExpectedRevision(input.expectedRevision);

      return withTransaction(pool, async (client) => {
        const values = [
          assignment.tenantId,
          assignment.characterId,
          JSON.stringify(assignment.skillVersionIds),
        ];

        const result =
          input.expectedRevision === null
            ? await client.query<AssignmentRow>(
                `INSERT INTO agents.character_skill_assignments(
                   tenant_id, character_id, skill_version_ids, revision
                 )
                 VALUES ($1,$2,$3::jsonb,1)
                 ON CONFLICT DO NOTHING
                 RETURNING *`,
                values,
              )
            : await client.query<AssignmentRow>(
                `UPDATE agents.character_skill_assignments
                    SET skill_version_ids = $3::jsonb,
                        revision = revision + 1
                  WHERE tenant_id = $1
                    AND character_id = $2
                    AND revision = $4
                  RETURNING *`,
                [...values, input.expectedRevision],
              );

        if (!result.rows[0]) {
          throw conflict(
            "agents.skill_assignment_revision_conflict",
            "Character Skill assignment changed since the supplied observation",
          );
        }
        return assignmentFromRow(result.rows[0]);
      });
    },
  });
}


export function createPostgresPlatformAgentProfileRepository(
  pool: Pool,
): PlatformAgentProfileRepository {
  return Object.freeze<PlatformAgentProfileRepository>({
    async readForCharacter(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<PlatformProfileRow>(
          `SELECT * FROM agents.platform_agent_profiles
            WHERE tenant_id = $1 AND character_id = $2`,
          [input.tenantId, input.characterId],
        );
        return result.rows[0] ? platformProfileFromRow(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async listSupportAgents(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<PlatformProfileRow>(
          `SELECT * FROM agents.platform_agent_profiles
            WHERE tenant_id = $1 AND support_agent = true
            ORDER BY character_id`,
          [input.tenantId],
        );
        return Object.freeze(result.rows.map(platformProfileFromRow));
      }, { isolation: "repeatable read", readOnly: true });
    },
    async listPlatformAgents(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<PlatformProfileRow>(
          `SELECT * FROM agents.platform_agent_profiles
            WHERE tenant_id = $1 ORDER BY character_id`,
          [input.tenantId],
        );
        return Object.freeze(result.rows.map(platformProfileFromRow));
      }, { isolation: "repeatable read", readOnly: true });
    },

    async put(input) {
      const profile = normalizePlatformAgentProfile(input.profile);
      assertExpectedRevision(input.expectedRevision);
      return withTransaction(pool, async (client) => {
        const values = [
          profile.tenantId,
          profile.characterId,
          profile.supportAgent,
          profile.defaultForNewUsers,
          profile.voiceProvider,
          profile.voiceName,
        ];
        const result = input.expectedRevision === null
          ? await client.query<PlatformProfileRow>(
              `INSERT INTO agents.platform_agent_profiles(
                 tenant_id, character_id, support_agent, default_for_new_users,
                 voice_provider, voice_name, revision
               ) VALUES ($1,$2,$3,$4,$5,$6,1)
               ON CONFLICT DO NOTHING
               RETURNING *`,
              values,
            )
          : await client.query<PlatformProfileRow>(
              `UPDATE agents.platform_agent_profiles
                  SET support_agent=$3, default_for_new_users=$4,
                      voice_provider=$5, voice_name=$6,
                      revision=revision+1
                WHERE tenant_id=$1 AND character_id=$2 AND revision=$7
                RETURNING *`,
              [...values, input.expectedRevision],
            );
        if (!result.rows[0]) {
          throw conflict(
            "agents.platform_profile_revision_conflict",
            "Platform agent profile changed since the supplied observation",
          );
        }
        return platformProfileFromRow(result.rows[0]);
      });
    },
  });
}

export function createPostgresUserAgentPreferenceRepository(
  pool: Pool,
): UserAgentPreferenceRepository {
  return Object.freeze<UserAgentPreferenceRepository>({
    async readForUser(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<UserPreferenceRow>(
          `SELECT * FROM agents.user_agent_preferences
            WHERE tenant_id = $1 AND user_id = $2`,
          [input.tenantId, input.userId],
        );
        return result.rows[0] ? userPreferenceFromRow(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async put(input) {
      const preference = normalizeUserAgentPreference(input.preference);
      assertExpectedRevision(input.expectedRevision);
      return withTransaction(pool, async (client) => {
        const values = [
          preference.tenantId,
          preference.userId,
          preference.defaultPlatformCharacterId,
        ];
        const result = input.expectedRevision === null
          ? await client.query<UserPreferenceRow>(
              `INSERT INTO agents.user_agent_preferences(
                 tenant_id, user_id, default_platform_character_id, revision
               ) VALUES ($1,$2,$3,1)
               ON CONFLICT DO NOTHING
               RETURNING *`,
              values,
            )
          : await client.query<UserPreferenceRow>(
              `UPDATE agents.user_agent_preferences
                  SET default_platform_character_id=$3, revision=revision+1
                WHERE tenant_id=$1 AND user_id=$2 AND revision=$4
                RETURNING *`,
              [...values, input.expectedRevision],
            );
        if (!result.rows[0]) {
          throw conflict(
            "agents.user_preference_revision_conflict",
            "User agent preference changed since the supplied observation",
          );
        }
        return userPreferenceFromRow(result.rows[0]);
      });
    },
  });
}
