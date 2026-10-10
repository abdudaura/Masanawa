import type { Pool, PoolClient } from "pg";
import {
  createCanonicalId, parseCanonicalId, toInstant,
  type TenantId, type UserId,
} from "@masanawa/contracts";
import type { PlatformAuthProfile } from "@masanawa/security";
import { createUser, linkExternalUserIdentity } from "../identity/repository.js";
import { withTransaction } from "../transaction.js";

interface CredentialRow {
  password_hash: string;
  failed_attempts: number;
  locked_until: Date | string | null;
  tenant_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  locale: string;
  created_at: Date | string;
}
type IdentityRow = Pick<CredentialRow,
  "tenant_id" | "user_id" | "display_name" | "email" | "phone" | "locale" | "created_at">;

function profile(row: IdentityRow): PlatformAuthProfile {
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", row.tenant_id),
    userId: parseCanonicalId("user", row.user_id),
    name: row.display_name,
    email: row.email,
    phone: row.phone,
    locale: row.locale,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  });
}

/** Namespace distinct from SMS OTP: a password does not prove control of a phone number. */
function localPasswordSubject(phone: string, observedAt: string) {
  return Object.freeze({
    system: "masanawa",
    namespace: "phone-password",
    value: phone,
    subjectKind: "user" as const,
    authenticationStrength: "linked" as const,
    observedAt: toInstant(observedAt),
    provenance: Object.freeze({ phoneOwnership: "unverified", method: "numeric-password" }),
  });
}

async function requireTenant(client: PoolClient, tenantId: TenantId, at: string) {
  await client.query(
    `INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
     VALUES ($1,$2,$2) ON CONFLICT (tenant_id) DO NOTHING`, [tenantId, at],
  );
  const existing = await client.query<{ state: string }>(
    "SELECT state FROM identity.tenants WHERE tenant_id=$1 FOR SHARE", [tenantId],
  );
  if (existing.rows[0]?.state !== "active") throw new Error("auth.tenant_inactive");
}

/**
 * Requires append-only security.platform_phone_password_credentials migration
 * and AF00 route wiring. Uses the same canonical Identity and session tables as OTP;
 * NO parallel user/session store and NO automatic phone verification.
 */
export function createPostgresPhonePasswordCredentials(pool: Pool) {
  return Object.freeze({
    async register(input: Readonly<{
      tenantId: TenantId; phone: string; name: string; locale: string;
      passwordHash: string; at: string;
    }>): Promise<PlatformAuthProfile> {
      try {
        return await withTransaction(pool, async (client) => {
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
            `auth:password:${input.tenantId}:${input.phone}`,
          ]);
          await requireTenant(client, input.tenantId, input.at);
          // An existing OTP-proven account with this number must never be claimed
          // by first-time unverified password registration.
          const existing = await client.query<{ user_id: string }>(
            "SELECT user_id FROM security.platform_user_profiles WHERE tenant_id=$1 AND phone=$2",
            [input.tenantId, input.phone],
          );
          if (existing.rowCount) throw new Error("auth.phone.duplicate");
          const userId: UserId = createCanonicalId("user");
          await createUser(client, {
            tenantId: input.tenantId, userId, createdAt: toInstant(input.at),
          });
          await linkExternalUserIdentity(client, {
            tenantId: input.tenantId, userId,
            subject: localPasswordSubject(input.phone, input.at),
            linkedAt: toInstant(input.at),
          });
          const result = await client.query<IdentityRow>(
            `INSERT INTO security.platform_user_profiles
             (tenant_id,user_id,display_name,email,phone,locale,created_at,updated_at)
             VALUES ($1,$2,$3,NULL,$4,$5,$6,$6)
             RETURNING tenant_id,user_id,display_name,email,phone,locale,created_at`,
            [input.tenantId, userId, input.name, input.phone, input.locale, input.at],
          );
          await client.query(
            `INSERT INTO security.platform_phone_password_credentials
             (tenant_id,phone,user_id,password_hash,failed_attempts,locked_until,created_at,updated_at)
             VALUES ($1,$2,$3,$4,0,NULL,$5,$5)`,
            [input.tenantId, input.phone, userId, input.passwordHash, input.at],
          );
          return profile(result.rows[0]!);
        });
      } catch (error) {
        if (error instanceof Error && error.message === "auth.phone.duplicate") throw error;
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          throw new Error("auth.phone.duplicate");
        }
        throw error;
      }
    },

    async authenticate(input: Readonly<{
      tenantId: TenantId; phone: string; at: string;
      verify: (hash: string | null) => Promise<boolean>;
    }>): Promise<PlatformAuthProfile | null> {
      return withTransaction(pool, async (client) => {
        const result = await client.query<CredentialRow>(
          `SELECT c.password_hash,c.failed_attempts,c.locked_until,
                  p.tenant_id,p.user_id,p.display_name,p.email,p.phone,p.locale,p.created_at
             FROM security.platform_phone_password_credentials c
             JOIN security.platform_user_profiles p
               ON p.tenant_id=c.tenant_id AND p.user_id=c.user_id AND p.phone=c.phone
             JOIN identity.users u
               ON u.tenant_id=c.tenant_id AND u.user_id=c.user_id
             JOIN identity.tenants t ON t.tenant_id=c.tenant_id
            WHERE c.tenant_id=$1 AND c.phone=$2
              AND u.state='active' AND t.state='active'
              FOR UPDATE OF c`,
          [input.tenantId, input.phone],
        );
        const row = result.rows[0];
        if (!row) {
          // Same memory-hard check for unknown numbers to reduce account enumeration.
          await input.verify(null);
          return null;
        }
        const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
        const attemptedAt = Date.parse(input.at);
        if (lockedUntil > attemptedAt) {
          await input.verify(null);
          throw new Error("auth.phone.locked");
        }
        const matched = await input.verify(row.password_hash);
        if (matched) {
          await client.query(
            `UPDATE security.platform_phone_password_credentials
                SET failed_attempts=0,locked_until=NULL,updated_at=$3
              WHERE tenant_id=$1 AND phone=$2`,
            [input.tenantId, input.phone, input.at],
          );
          return profile(row);
        }
        const attempts = lockedUntil > 0 && lockedUntil <= attemptedAt
          ? 1 : Number(row.failed_attempts) + 1;
        const nextLock = attempts >= 5
          ? new Date(attemptedAt + 15 * 60_000).toISOString() : null;
        await client.query(
          `UPDATE security.platform_phone_password_credentials
              SET failed_attempts=$3,locked_until=$4,updated_at=$5
            WHERE tenant_id=$1 AND phone=$2`,
          [input.tenantId, input.phone, attempts, nextLock, input.at],
        );
        return null;
      });
    },
  });
}
