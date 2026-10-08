import type {
  HumanProfileRecord,
  HumanProfileView,
  PersonaProfileRecord,
  PersonaProfileView,
  TalkCardProjection,
  TalkProfileRepository,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkProfileSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface HumanRow extends Record<string, unknown> {
  tenant_id: string;
  user_id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  live_talk_id: string | null;
  twin_public_id: string | null;
  twin_display_name: string | null;
  talks_json: unknown;
  follower_count: string | number;
  following_count: string | number;
  is_following: boolean;
}

interface PersonaRow extends Record<string, unknown> {
  tenant_id: string;
  public_id: string;
  display_name: string;
  kind: "expert" | "twin";
  seat_fee_label: string;
  is_available: boolean;
  role: string;
  bio: string;
  avatar_url: string | null;
  owner_handle: string | null;
  owner_display_name: string | null;
  topics_json: unknown;
  appearances_json: unknown;
  is_verified: boolean;
}

function talks(value: unknown): readonly TalkCardProjection[] {
  return Array.isArray(value) ? value as TalkCardProjection[] : [];
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function human(row: HumanRow): HumanProfileView {
  return Object.freeze({
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    liveTalkId: row.live_talk_id,
    twinPublicId: row.twin_public_id,
    twinDisplayName: row.twin_display_name,
    talks: talks(row.talks_json),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: row.is_following,
    isLive: row.live_talk_id !== null,
  });
}

function persona(row: PersonaRow): PersonaProfileView {
  return Object.freeze({
    publicId: row.public_id,
    displayName: row.display_name,
    kind: row.kind,
    seatFeeLabel: row.seat_fee_label,
    isAvailable: row.is_available,
    role: row.role,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    ownerHandle: row.owner_handle,
    ownerDisplayName: row.owner_display_name,
    topics: strings(row.topics_json),
    appearances: talks(row.appearances_json),
    isVerified: row.is_verified,
  });
}

const humanSelect = `
  SELECT p.tenant_id, p.user_id, p.handle, p.display_name, p.bio, p.avatar_url,
         p.live_talk_id, p.twin_public_id, p.twin_display_name, p.talks_json,
         (SELECT count(*)::int FROM talks.follows f
           WHERE f.tenant_id = p.tenant_id AND f.followed_user_id = p.user_id) AS follower_count,
         (SELECT count(*)::int FROM talks.follows f
           WHERE f.tenant_id = p.tenant_id AND f.follower_user_id = p.user_id) AS following_count,
         EXISTS (
           SELECT 1 FROM talks.follows f
            WHERE f.tenant_id = p.tenant_id
              AND f.follower_user_id = $2
              AND f.followed_user_id = p.user_id
         ) AS is_following
    FROM talks.public_profiles p
   WHERE p.tenant_id = $1 AND p.handle = $3
     AND NOT EXISTS (
       SELECT 1 FROM talks.safety_enforcement se
        WHERE se.tenant_id = p.tenant_id
          AND se.target_kind = 'profile'
          AND se.target_id = p.handle
          AND se.visibility IN ('restricted','blocked')
     )
   LIMIT 1
`;


const humanSelectByUserId = `
  SELECT p.tenant_id, p.user_id, p.handle, p.display_name, p.bio, p.avatar_url,
         p.live_talk_id, p.twin_public_id, p.twin_display_name, p.talks_json,
         (SELECT count(*)::int FROM talks.follows f
           WHERE f.tenant_id = p.tenant_id AND f.followed_user_id = p.user_id) AS follower_count,
         (SELECT count(*)::int FROM talks.follows f
           WHERE f.tenant_id = p.tenant_id AND f.follower_user_id = p.user_id) AS following_count,
         EXISTS (
           SELECT 1 FROM talks.follows f
            WHERE f.tenant_id = p.tenant_id
              AND f.follower_user_id = $2
              AND f.followed_user_id = p.user_id
         ) AS is_following
    FROM talks.public_profiles p
   WHERE p.tenant_id = $1 AND p.user_id = $3
     AND ($2 = $3 OR NOT EXISTS (
       SELECT 1 FROM talks.safety_enforcement se
        WHERE se.tenant_id = p.tenant_id
          AND se.target_kind = 'profile'
          AND se.target_id = p.handle
          AND se.visibility IN ('restricted','blocked')
     ))
   LIMIT 1
`;

export function createPostgresTalkProfileRepository(
  pool: TalkProfileSqlPool,
): TalkProfileRepository {
  async function readHuman(input: {
    tenantId: string;
    viewerUserId: string;
    handle: string;
  }): Promise<HumanProfileView | null> {
    const result = await pool.query<HumanRow>(humanSelect, [
      input.tenantId,
      input.viewerUserId,
      input.handle,
    ]);
    return result.rows[0] ? human(result.rows[0]) : null;
  }

  async function readHumanByUserId(input: {
    tenantId: string;
    viewerUserId: string;
    userId: string;
  }): Promise<HumanProfileView | null> {
    const result = await pool.query<HumanRow>(humanSelectByUserId, [
      input.tenantId,
      input.viewerUserId,
      input.userId,
    ]);
    return result.rows[0] ? human(result.rows[0]) : null;
  }

  return Object.freeze<TalkProfileRepository>({
    readHuman,
    readHumanByUserId,

    async createOwnHuman(input) {
      const inserted = await pool.query<{ user_id: string }>(
        `INSERT INTO talks.public_profiles (
          tenant_id, user_id, handle, display_name, bio, avatar_url,
          live_talk_id, twin_public_id, twin_display_name, talks_json, updated_at
        ) VALUES ($1,$2,$3,$4,$5,NULL,NULL,NULL,NULL,'[]'::jsonb,clock_timestamp())
        ON CONFLICT (tenant_id,user_id) DO NOTHING
        RETURNING user_id`,
        [input.tenantId, input.userId, input.handle, input.displayName, input.bio],
      );
      if (!inserted.rows[0]) return null;
      return readHumanByUserId({
        tenantId: input.tenantId,
        viewerUserId: input.userId,
        userId: input.userId,
      });
    },

    async updateOwnHuman(input) {
      const fields: string[] = [];
      const values: unknown[] = [input.tenantId, input.userId];
      if (input.displayName !== undefined) {
        values.push(input.displayName);
        fields.push("display_name = $" + values.length);
      }
      if (input.bio !== undefined) {
        values.push(input.bio);
        fields.push("bio = $" + values.length);
      }
      if (input.removeAvatar === true) {
        fields.push("avatar_url = NULL");
      }
      if (fields.length === 0) return null;
      const updateSql =
        "UPDATE talks.public_profiles SET " + fields.join(", ") +
        ", updated_at = clock_timestamp()" +
        " WHERE tenant_id = $1 AND user_id = $2 RETURNING user_id";
      // Older mobile APKs still send removeAvatar through PATCH /profiles/me.
      // Atomically retire its managed object in the journal in that same SQL
      // statement; otherwise the now-unreferenced S3 file would leak forever.
      const statement = input.removeAvatar === true
        ? [
            "WITH previous AS (",
            "SELECT user_id,avatar_url FROM talks.public_profiles",
            "WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE",
            "), updated AS (",
            "UPDATE talks.public_profiles p SET " + fields.join(", ") +
              ",updated_at=clock_timestamp()",
            "FROM previous WHERE p.tenant_id=$1 AND p.user_id=$2",
            "AND previous.user_id=p.user_id",
            "RETURNING p.user_id,previous.avatar_url AS prior_url",
            "), orphaned AS (",
            "UPDATE talks.profile_avatar_objects",
            "SET state='orphaned', updated_at=clock_timestamp()",
            "WHERE tenant_id=$1 AND user_id=$2 AND state='active'",
            "AND public_url=(SELECT prior_url FROM updated)",
            "RETURNING object_key",
            ") SELECT user_id FROM updated",
          ].join(" ")
        : updateSql;
      const updated = await pool.query<{ user_id: string }>(statement, values);
      if (!updated.rows[0]) return null;
      return readHumanByUserId({
        tenantId: input.tenantId,
        viewerUserId: input.userId,
        userId: input.userId,
      });
    },

    async setFollowing(input) {
      const target = await pool.query<{ user_id: string }>(
        `SELECT p.user_id FROM talks.public_profiles p
          WHERE p.tenant_id = $1 AND p.handle = $2
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id = p.tenant_id
                 AND se.target_kind = 'profile'
                 AND se.target_id = p.handle
                 AND se.visibility IN ('restricted','blocked')
            )
          LIMIT 1`,
        [input.tenantId, input.handle],
      );
      const targetUserId = target.rows[0]?.user_id;
      if (!targetUserId) return null;

      if (targetUserId === input.viewerUserId) {
        throw new Error("profiles.cannot_follow_self");
      }

      if (input.following) {
        await pool.query(
          `INSERT INTO talks.follows (
            tenant_id, follower_user_id, followed_user_id, created_at
          ) VALUES ($1,$2,$3,$4)
          ON CONFLICT (tenant_id, follower_user_id, followed_user_id) DO NOTHING`,
          [input.tenantId, input.viewerUserId, targetUserId, input.changedAt],
        );
      } else {
        await pool.query(
          `DELETE FROM talks.follows
            WHERE tenant_id = $1
              AND follower_user_id = $2
              AND followed_user_id = $3`,
          [input.tenantId, input.viewerUserId, targetUserId],
        );
      }

      return readHuman({
        tenantId: input.tenantId,
        viewerUserId: input.viewerUserId,
        handle: input.handle,
      });
    },

    async setFollowingByUserId(input) {
      const target = await pool.query<{ user_id: string; handle: string }>(
        `SELECT p.user_id, p.handle FROM talks.public_profiles p
          WHERE p.tenant_id = $1 AND p.user_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id = p.tenant_id
                 AND se.target_kind = 'profile'
                 AND se.target_id = p.handle
                 AND se.visibility IN ('restricted','blocked')
            )
          LIMIT 1`,
        [input.tenantId, input.userId],
      );
      const targetUserId = target.rows[0]?.user_id;
      if (!targetUserId) return null;
      if (targetUserId === input.viewerUserId) {
        throw new Error("profiles.cannot_follow_self");
      }

      if (input.following) {
        await pool.query(
          `INSERT INTO talks.follows (
            tenant_id, follower_user_id, followed_user_id, created_at
          ) VALUES ($1,$2,$3,$4)
          ON CONFLICT (tenant_id, follower_user_id, followed_user_id) DO NOTHING`,
          [input.tenantId, input.viewerUserId, targetUserId, input.changedAt],
        );
      } else {
        await pool.query(
          `DELETE FROM talks.follows
            WHERE tenant_id = $1
              AND follower_user_id = $2
              AND followed_user_id = $3`,
          [input.tenantId, input.viewerUserId, targetUserId],
        );
      }

      return readHumanByUserId({
        tenantId: input.tenantId,
        viewerUserId: input.viewerUserId,
        userId: input.userId,
      });
    },

    async readPersona(input) {
      const result = await pool.query<PersonaRow>(
        `SELECT tenant_id, public_id, display_name, kind, seat_fee_label,
                is_available, role, bio, avatar_url, owner_handle,
                owner_display_name, topics_json, appearances_json, is_verified
           FROM talks.persona_profiles p
          WHERE p.tenant_id = $1 AND p.public_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id = p.tenant_id
                 AND se.target_kind = 'persona'
                 AND se.target_id = p.public_id
                 AND se.visibility IN ('restricted','blocked')
            )
          LIMIT 1`,
        [input.tenantId, input.publicId],
      );
      return result.rows[0] ? persona(result.rows[0]) : null;
    },

    async upsertHuman(input: HumanProfileRecord) {
      await pool.query(
        `INSERT INTO talks.public_profiles (
          tenant_id, user_id, handle, display_name, bio, avatar_url,
          live_talk_id, twin_public_id, twin_display_name, talks_json, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,clock_timestamp())
        ON CONFLICT (tenant_id, user_id) DO UPDATE
          SET handle = EXCLUDED.handle,
              display_name = EXCLUDED.display_name,
              bio = EXCLUDED.bio,
              avatar_url = EXCLUDED.avatar_url,
              live_talk_id = EXCLUDED.live_talk_id,
              twin_public_id = EXCLUDED.twin_public_id,
              twin_display_name = EXCLUDED.twin_display_name,
              talks_json = EXCLUDED.talks_json,
              updated_at = clock_timestamp()`,
        [
          input.tenantId,
          input.userId,
          input.handle,
          input.displayName,
          input.bio,
          input.avatarUrl,
          input.liveTalkId,
          input.twinPublicId,
          input.twinDisplayName,
          JSON.stringify(input.talks),
        ],
      );
    },

    async upsertPersona(input: PersonaProfileRecord) {
      await pool.query(
        `INSERT INTO talks.persona_profiles (
          tenant_id, public_id, display_name, kind, seat_fee_label, is_available,
          role, bio, avatar_url, owner_handle, owner_display_name,
          topics_json, appearances_json, is_verified, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,clock_timestamp())
        ON CONFLICT (tenant_id, public_id) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              kind = EXCLUDED.kind,
              seat_fee_label = EXCLUDED.seat_fee_label,
              is_available = EXCLUDED.is_available,
              role = EXCLUDED.role,
              bio = EXCLUDED.bio,
              avatar_url = EXCLUDED.avatar_url,
              owner_handle = EXCLUDED.owner_handle,
              owner_display_name = EXCLUDED.owner_display_name,
              topics_json = EXCLUDED.topics_json,
              appearances_json = EXCLUDED.appearances_json,
              is_verified = EXCLUDED.is_verified,
              updated_at = clock_timestamp()`,
        [
          input.tenantId,
          input.publicId,
          input.displayName,
          input.kind,
          input.seatFeeLabel,
          input.isAvailable,
          input.role,
          input.bio,
          input.avatarUrl,
          input.ownerHandle,
          input.ownerDisplayName,
          JSON.stringify(input.topics),
          JSON.stringify(input.appearances),
          input.isVerified,
        ],
      );
    },
  });
}

