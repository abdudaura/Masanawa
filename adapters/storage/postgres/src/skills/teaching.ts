import type { Pool } from "pg";
import {
  normalizeTeachingProgress,
  type TeachingProgress,
  type TeachingProgressRepository,
  type TeachingProgressScope,
} from "@masanawa/skills";

interface Row {
  tenant_id: string;
  user_id: string;
  character_id: string;
  relationship_id: string;
  topic: string;
  goal: string;
  learner_level: string;
  checkpoint: string;
  next_step: string;
  mastery_notes: unknown;
  updated_at: Date | string;
}

function restore(row: Row): TeachingProgress {
  return normalizeTeachingProgress({
    tenantId: row.tenant_id as never,
    userId: row.user_id as never,
    characterId: row.character_id as never,
    relationshipId: row.relationship_id as never,
    topic: row.topic,
    goal: row.goal,
    level: row.learner_level,
    checkpoint: row.checkpoint,
    nextStep: row.next_step,
    masteryNotes: Array.isArray(row.mastery_notes)
      ? row.mastery_notes.filter((value): value is string => typeof value === "string")
      : [],
    updatedAt: (row.updated_at instanceof Date
      ? row.updated_at
      : new Date(row.updated_at)).toISOString() as never,
  });
}

export function createPostgresTeachingProgressRepository(
  pool: Pool,
): TeachingProgressRepository {
  return Object.freeze({
    async read(scope: TeachingProgressScope) {
      const result = await pool.query<Row>(
        `SELECT tenant_id,user_id,character_id,relationship_id,topic,goal,
                learner_level,checkpoint,next_step,mastery_notes,updated_at
           FROM skills.teaching_progress
          WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3 AND relationship_id=$4`,
        [scope.tenantId,scope.userId,scope.characterId,scope.relationshipId],
      );
      return result.rows[0] ? restore(result.rows[0]) : null;
    },

    async upsert(value: TeachingProgress) {
      const progress = normalizeTeachingProgress(value);
      await pool.query(
        `INSERT INTO skills.teaching_progress(
           tenant_id,user_id,character_id,relationship_id,topic,goal,
           learner_level,checkpoint,next_step,mastery_notes,updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
         ON CONFLICT (tenant_id,user_id,character_id,relationship_id)
         DO UPDATE SET topic=EXCLUDED.topic,goal=EXCLUDED.goal,
           learner_level=EXCLUDED.learner_level,
           checkpoint=EXCLUDED.checkpoint,next_step=EXCLUDED.next_step,
           mastery_notes=EXCLUDED.mastery_notes,updated_at=EXCLUDED.updated_at`,
        [
          progress.tenantId,progress.userId,progress.characterId,
          progress.relationshipId,progress.topic,progress.goal,progress.level,
          progress.checkpoint,progress.nextStep,
          JSON.stringify(progress.masteryNotes),progress.updatedAt,
        ],
      );
    },
  });
}
