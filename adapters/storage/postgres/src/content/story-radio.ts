import type {
  StoryEpisode,
  StoryListeningProgress,
  StoryRadioRepository,
  StoryReaction,
  StoryReactionSummary,
  StorySeries,
} from "@masanawa/content";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function series(row: any): StorySeries {
  return Object.freeze({
    tenantId: row.tenant_id,
    seriesId: row.series_id,
    title: row.title,
    description: row.description,
    language: row.language,
    audienceLabel: row.audience_label,
    artworkUrl: row.artwork_url,
    state: row.state,
    publishedAt: row.published_at ? iso(row.published_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

function episode(row: any): StoryEpisode {
  return Object.freeze({
    tenantId: row.tenant_id,
    episodeId: row.episode_id,
    seriesId: row.series_id,
    seasonNumber: Number(row.season_number),
    episodeNumber: Number(row.episode_number),
    title: row.title,
    description: row.description,
    durationSeconds: Number(row.duration_seconds),
    audioUrl: row.audio_url,
    artworkUrl: row.artwork_url,
    state: row.state,
    publishedAt: row.published_at ? iso(row.published_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

function progress(row: any): StoryListeningProgress {
  return Object.freeze({
    tenantId: row.tenant_id,
    userId: row.user_id,
    seriesId: row.series_id,
    episodeId: row.episode_id,
    positionSeconds: Number(row.position_seconds),
    durationSeconds: Number(row.duration_seconds),
    completed: row.completed,
    updatedAt: iso(row.updated_at),
  });
}

const emptyCounts = (): Record<StoryReaction, number> => ({
  like: 0,
  love: 0,
  funny: 0,
  thoughtful: 0,
});

export function createPostgresStoryRadioRepository(pool: Pool): StoryRadioRepository {
  async function reactionSummary(input: {
    tenantId: string;
    userId: string;
    episodeId: string;
  }): Promise<StoryReactionSummary> {
    const countsResult = await pool.query<{ reaction: StoryReaction; count: string }>(
      `SELECT reaction, count(*)::text AS count
         FROM content.story_reactions
        WHERE tenant_id=$1 AND episode_id=$2
        GROUP BY reaction`,
      [input.tenantId, input.episodeId],
    );
    const mineResult = await pool.query<{ reaction: StoryReaction }>(
      `SELECT reaction FROM content.story_reactions
        WHERE tenant_id=$1 AND user_id=$2 AND episode_id=$3`,
      [input.tenantId, input.userId, input.episodeId],
    );
    const counts = emptyCounts();
    for (const row of countsResult.rows) counts[row.reaction] = Number(row.count);
    return Object.freeze({
      counts: Object.freeze(counts),
      mine: mineResult.rows[0]?.reaction ?? null,
    });
  }

  return Object.freeze({
    async createSeries(input) {
      const result = await pool.query(
        `INSERT INTO content.story_series(
          tenant_id,series_id,title,description,language,audience_label,artwork_url,
          state,published_at,created_at,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,'draft',NULL,$8,$8)
        RETURNING *`,
        [
          input.tenantId,input.seriesId,input.title,input.description,input.language,
          input.audienceLabel,input.artworkUrl,input.createdAt,
        ],
      );
      return series(result.rows[0]!);
    },

    async updateSeries(input) {
      const result = await pool.query(
        `UPDATE content.story_series
            SET title=$3,description=$4,language=$5,audience_label=$6,artwork_url=$7,updated_at=$8
          WHERE tenant_id=$1 AND series_id=$2
          RETURNING *`,
        [
          input.tenantId,input.seriesId,input.title,input.description,input.language,
          input.audienceLabel,input.artworkUrl,input.updatedAt,
        ],
      );
      return result.rows[0] ? series(result.rows[0]) : null;
    },

    async setSeriesPublication(input) {
      return withTransaction(pool, async (client) => {
        const locked = await client.query(
          `SELECT series_id
             FROM content.story_series
            WHERE tenant_id=$1 AND series_id=$2
            FOR UPDATE`,
          [input.tenantId,input.seriesId],
        );
        if (locked.rowCount !== 1) return null;

        if (input.published) {
          const count = await client.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM content.story_episodes
              WHERE tenant_id=$1 AND series_id=$2 AND state='published'`,
            [input.tenantId,input.seriesId],
          );
          if (Number(count.rows[0]?.count ?? 0) < 1) {
            throw new Error("story_radio.series.requires_published_episode");
          }
        }
        const result = await client.query(
          `UPDATE content.story_series
              SET state=$3,
                  published_at=CASE WHEN $3='published' THEN COALESCE(published_at,$4::timestamptz) ELSE NULL END,
                  updated_at=$4
            WHERE tenant_id=$1 AND series_id=$2
            RETURNING *`,
          [input.tenantId,input.seriesId,input.published ? "published" : "draft",input.at],
        );
        return result.rows[0] ? series(result.rows[0]) : null;
      });
    },

    async createEpisode(input) {
      const result = await pool.query(
        `INSERT INTO content.story_episodes(
          tenant_id,episode_id,series_id,season_number,episode_number,title,description,
          duration_seconds,audio_url,artwork_url,state,published_at,created_at,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',NULL,$11,$11)
        RETURNING *`,
        [
          input.tenantId,input.episodeId,input.seriesId,input.seasonNumber,input.episodeNumber,
          input.title,input.description,input.durationSeconds,input.audioUrl,input.artworkUrl,input.createdAt,
        ],
      );
      return episode(result.rows[0]!);
    },

    async updateEpisode(input) {
      const result = await pool.query(
        `UPDATE content.story_episodes
            SET season_number=$3,episode_number=$4,title=$5,description=$6,
                duration_seconds=$7,audio_url=$8,artwork_url=$9,updated_at=$10
          WHERE tenant_id=$1 AND episode_id=$2
          RETURNING *`,
        [
          input.tenantId,input.episodeId,input.seasonNumber,input.episodeNumber,
          input.title,input.description,input.durationSeconds,input.audioUrl,
          input.artworkUrl,input.updatedAt,
        ],
      );
      return result.rows[0] ? episode(result.rows[0]) : null;
    },

    async setEpisodePublication(input) {
      return withTransaction(pool, async (client) => {
        if (!input.published) {
          const current = await client.query<{
            series_id: string;
            episode_state: string;
            series_state: string;
          }>(
            `SELECT e.series_id,
                    e.state AS episode_state,
                    s.state AS series_state
               FROM content.story_episodes e
               JOIN content.story_series s
                 ON s.tenant_id=e.tenant_id AND s.series_id=e.series_id
              WHERE e.tenant_id=$1 AND e.episode_id=$2
              FOR UPDATE OF e,s`,
            [input.tenantId,input.episodeId],
          );
          const row = current.rows[0];
          if (
            row?.episode_state === "published" &&
            row.series_state === "published"
          ) {
            const count = await client.query<{ count: string }>(
              `SELECT count(*)::text AS count
                 FROM content.story_episodes
                WHERE tenant_id=$1 AND series_id=$2 AND state='published'`,
              [input.tenantId,row.series_id],
            );
            if (Number(count.rows[0]?.count ?? 0) <= 1) {
              throw new Error(
                "story_radio.episode.last_published_in_live_series",
              );
            }
          }
        }
        const result = await client.query(
          `UPDATE content.story_episodes
              SET state=$3,
                  published_at=CASE WHEN $3='published' THEN COALESCE(published_at,$4::timestamptz) ELSE NULL END,
                  updated_at=$4
            WHERE tenant_id=$1 AND episode_id=$2
            RETURNING *`,
          [input.tenantId,input.episodeId,input.published ? "published" : "draft",input.at],
        );
        return result.rows[0] ? episode(result.rows[0]) : null;
      });
    },

    async listSeries(input) {
      const result = await pool.query(
        `SELECT * FROM content.story_series
          WHERE tenant_id=$1 ORDER BY updated_at DESC,series_id`,
        [input.tenantId],
      );
      return Object.freeze(result.rows.map(series));
    },

    async getSeries(input) {
      const result = await pool.query(
        `SELECT * FROM content.story_series
          WHERE tenant_id=$1 AND series_id=$2`,
        [input.tenantId,input.seriesId],
      );
      return result.rows[0] ? series(result.rows[0]) : null;
    },

    async listEpisodes(input) {
      const result = await pool.query(
        `SELECT * FROM content.story_episodes
          WHERE tenant_id=$1 AND series_id=$2
          ORDER BY season_number,episode_number,episode_id`,
        [input.tenantId,input.seriesId],
      );
      return Object.freeze(result.rows.map(episode));
    },

    async listPublishedSeries(input) {
      const result = await pool.query(
        `SELECT s.*
           FROM content.story_series s
          WHERE s.tenant_id=$1 AND s.state='published'
            AND EXISTS (
              SELECT 1 FROM content.story_episodes e
              WHERE e.tenant_id=s.tenant_id AND e.series_id=s.series_id AND e.state='published'
            )
          ORDER BY s.published_at DESC,s.series_id`,
        [input.tenantId],
      );
      return Object.freeze(result.rows.map(series));
    },

    async getPublishedSeries(input) {
      const result = await pool.query(
        `SELECT * FROM content.story_series
          WHERE tenant_id=$1 AND series_id=$2 AND state='published'`,
        [input.tenantId,input.seriesId],
      );
      return result.rows[0] ? series(result.rows[0]) : null;
    },

    async listPublishedEpisodes(input) {
      const result = await pool.query(
        `SELECT * FROM content.story_episodes
          WHERE tenant_id=$1 AND series_id=$2 AND state='published'
          ORDER BY season_number,episode_number,episode_id`,
        [input.tenantId,input.seriesId],
      );
      return Object.freeze(result.rows.map(episode));
    },

    async getPublishedEpisode(input) {
      const result = await pool.query(
        `SELECT e.* FROM content.story_episodes e
          JOIN content.story_series s
            ON s.tenant_id=e.tenant_id AND s.series_id=e.series_id
          WHERE e.tenant_id=$1 AND e.episode_id=$2
            AND e.state='published' AND s.state='published'`,
        [input.tenantId,input.episodeId],
      );
      return result.rows[0] ? episode(result.rows[0]) : null;
    },

    async getContinueProgress(input) {
      const result = await pool.query(
        `SELECT p.*
           FROM content.story_listening_progress p
           JOIN content.story_episodes e
             ON e.tenant_id=p.tenant_id AND e.episode_id=p.episode_id
           JOIN content.story_series s
             ON s.tenant_id=e.tenant_id AND s.series_id=e.series_id
          WHERE p.tenant_id=$1 AND p.user_id=$2
            AND e.state='published' AND s.state='published'
          ORDER BY p.updated_at DESC LIMIT 1`,
        [input.tenantId,input.userId],
      );
      return result.rows[0] ? progress(result.rows[0]) : null;
    },

    async saveProgress(input) {
      const eligible = await pool.query(
        `SELECT 1 FROM content.story_episodes e
          JOIN content.story_series s
            ON s.tenant_id=e.tenant_id AND s.series_id=e.series_id
          WHERE e.tenant_id=$1 AND e.episode_id=$2 AND e.series_id=$3
            AND e.state='published' AND s.state='published'
            AND e.duration_seconds=$4`,
        [input.tenantId,input.episodeId,input.seriesId,input.durationSeconds],
      );
      if (eligible.rowCount !== 1) throw new Error("story_radio.episode.unavailable");
      const result = await pool.query(
        `INSERT INTO content.story_listening_progress(
          tenant_id,user_id,series_id,episode_id,position_seconds,duration_seconds,completed,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (tenant_id,user_id,episode_id)
        DO UPDATE SET position_seconds=EXCLUDED.position_seconds,
                      duration_seconds=EXCLUDED.duration_seconds,
                      completed=EXCLUDED.completed,
                      updated_at=EXCLUDED.updated_at
        WHERE content.story_listening_progress.updated_at <= EXCLUDED.updated_at
        RETURNING *`,
        [
          input.tenantId,input.userId,input.seriesId,input.episodeId,
          input.positionSeconds,input.durationSeconds,input.completed,input.updatedAt,
        ],
      );
      if (result.rows[0]) return progress(result.rows[0]);
      const current = await pool.query(
        `SELECT * FROM content.story_listening_progress
          WHERE tenant_id=$1 AND user_id=$2 AND episode_id=$3`,
        [input.tenantId,input.userId,input.episodeId],
      );
      if (!current.rows[0]) throw new Error("story_radio.progress.persistence_failed");
      return progress(current.rows[0]);
    },

    async getReactionSummary(input) {
      const eligible = await pool.query(
        `SELECT 1 FROM content.story_episodes e
          JOIN content.story_series s ON s.tenant_id=e.tenant_id AND s.series_id=e.series_id
          WHERE e.tenant_id=$1 AND e.episode_id=$2 AND e.state='published' AND s.state='published'`,
        [input.tenantId,input.episodeId],
      );
      if (eligible.rowCount !== 1) throw new Error("story_radio.episode.unavailable");
      return reactionSummary(input);
    },

    async setReaction(input) {
      const eligible = await pool.query(
        `SELECT 1 FROM content.story_episodes e
          JOIN content.story_series s ON s.tenant_id=e.tenant_id AND s.series_id=e.series_id
          WHERE e.tenant_id=$1 AND e.episode_id=$2 AND e.state='published' AND s.state='published'`,
        [input.tenantId,input.episodeId],
      );
      if (eligible.rowCount !== 1) throw new Error("story_radio.episode.unavailable");
      await pool.query(
        `INSERT INTO content.story_reactions(tenant_id,user_id,episode_id,reaction,updated_at)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id,user_id,episode_id)
         DO UPDATE SET reaction=EXCLUDED.reaction,updated_at=EXCLUDED.updated_at`,
        [input.tenantId,input.userId,input.episodeId,input.reaction,input.updatedAt],
      );
      return reactionSummary(input);
    },
  });
}
