import type { CharacterId, Instant, TenantId, UserId } from "@masanawa/contracts";
import type { Pool } from "pg";

export interface TwinProfileImage {
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly bytes: Uint8Array;
  readonly updatedAt: Instant;
}

export interface TwinProfileImageRepository {
  put(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly ownerUserId: UserId;
    readonly contentType: "image/jpeg" | "image/png" | "image/webp";
    readonly bytes: Uint8Array;
    readonly updatedAt: Instant;
  }): Promise<void>;
  read(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<TwinProfileImage | null>;
}

export function createPostgresTwinProfileImageRepository(
  pool: Pool,
): TwinProfileImageRepository {
  return Object.freeze({
    async put(input) {
      if (input.bytes.byteLength < 1 || input.bytes.byteLength > 4 * 1024 * 1024) {
        throw new RangeError("Twin profile image is too large");
      }
      await pool.query(
        `INSERT INTO identity.twin_profile_images(
           tenant_id, character_id, owner_user_id, content_type, image_bytes, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, character_id) DO UPDATE SET
           owner_user_id=EXCLUDED.owner_user_id,
           content_type=EXCLUDED.content_type,
           image_bytes=EXCLUDED.image_bytes,
           updated_at=EXCLUDED.updated_at`,
        [
          input.tenantId,
          input.characterId,
          input.ownerUserId,
          input.contentType,
          Buffer.from(input.bytes),
          input.updatedAt,
        ],
      );
    },

    async read(input) {
      const result = await pool.query<{
        content_type: "image/jpeg" | "image/png" | "image/webp";
        image_bytes: Buffer;
        updated_at: Date | string;
      }>(
        `SELECT content_type, image_bytes, updated_at
           FROM identity.twin_profile_images
          WHERE tenant_id=$1 AND character_id=$2`,
        [input.tenantId, input.characterId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return Object.freeze({
        contentType: row.content_type,
        bytes: new Uint8Array(row.image_bytes),
        updatedAt: (row.updated_at instanceof Date
          ? row.updated_at
          : new Date(row.updated_at)).toISOString() as Instant,
      });
    },
  });
}
