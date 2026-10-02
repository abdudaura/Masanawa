import {
  PlatformError,
  isCanonicalId,
  type CredentialRefId,
  type ProviderId,
  type TenantId,
} from "@masanawa/contracts";
import {
  CredentialSecret,
  normalizeCredentialResolutionRequest,
  normalizeEncryptedCredentialEnvelope,
  type CredentialEnvelopeCipher,
  type CredentialMaterialSource,
  type CredentialResolutionRequest,
  type EncryptedCredentialEnvelope,
} from "@masanawa/security";
import type { PoolClient } from "pg";

interface CredentialRow {
  tenant_id: TenantId;
  credential_ref_id: CredentialRefId;
  provider_id: ProviderId;
  slot_key: string;
  generation: number;
  algorithm: string;
  key_id: string;
  ciphertext: string;
  nonce: string | null;
  active: boolean;
}

function normalizeSlotKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized.length > 128 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(normalized)
  ) {
    throw new TypeError("credential slotKey is invalid");
  }
  return normalized;
}

function assertIds(
  tenantId: TenantId,
  credentialRefId: CredentialRefId,
  providerId: ProviderId,
): void {
  if (!isCanonicalId("tenant", tenantId)) {
    throw new TypeError("credential tenantId is invalid");
  }
  if (!isCanonicalId("credential-ref", credentialRefId)) {
    throw new TypeError("credentialRefId is invalid");
  }
  if (!isCanonicalId("provider", providerId)) {
    throw new TypeError("credential providerId is invalid");
  }
}

function toEnvelope(row: CredentialRow): EncryptedCredentialEnvelope {
  return normalizeEncryptedCredentialEnvelope({
    algorithm: row.algorithm,
    keyId: row.key_id,
    ciphertext: row.ciphertext,
    nonce: row.nonce,
  });
}

export async function createProviderCredentialRef(
  client: PoolClient,
  cipher: CredentialEnvelopeCipher,
  input: {
    readonly tenantId: TenantId;
    readonly credentialRefId: CredentialRefId;
    readonly providerId: ProviderId;
    readonly slotKey: string;
    readonly plaintext: string;
  },
): Promise<void> {
  assertIds(input.tenantId, input.credentialRefId, input.providerId);
  const slotKey = normalizeSlotKey(input.slotKey);
  const generation = 1;
  const envelope = normalizeEncryptedCredentialEnvelope(
    await cipher.seal({
      plaintext: input.plaintext,
      tenantId: input.tenantId,
      credentialRefId: input.credentialRefId,
      providerId: input.providerId,
      slotKey,
      generation,
    }),
  );

  try {
    await client.query(
      `INSERT INTO security.credential_refs (
         tenant_id,
         credential_ref_id,
         provider_id,
         slot_key,
         generation,
         algorithm,
         key_id,
         ciphertext,
         nonce,
         active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [
        input.tenantId,
        input.credentialRefId,
        input.providerId,
        slotKey,
        generation,
        envelope.algorithm,
        envelope.keyId,
        envelope.ciphertext,
        envelope.nonce,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new PlatformError({
        code: "credential.registration_conflict",
        category: "conflict",
        message: "Credential reference is already registered",
        retryable: false,
      });
    }
    throw error;
  }
}

export async function rotateProviderCredentialRef(
  client: PoolClient,
  cipher: CredentialEnvelopeCipher,
  input: {
    readonly tenantId: TenantId;
    readonly credentialRefId: CredentialRefId;
    readonly providerId: ProviderId;
    readonly slotKey: string;
    readonly expectedGeneration: number;
    readonly plaintext: string;
  },
): Promise<number> {
  assertIds(input.tenantId, input.credentialRefId, input.providerId);
  const slotKey = normalizeSlotKey(input.slotKey);
  if (
    !Number.isSafeInteger(input.expectedGeneration) ||
    input.expectedGeneration < 1
  ) {
    throw new RangeError("expectedGeneration must be a positive integer");
  }
  const generation = input.expectedGeneration + 1;
  const envelope = normalizeEncryptedCredentialEnvelope(
    await cipher.seal({
      plaintext: input.plaintext,
      tenantId: input.tenantId,
      credentialRefId: input.credentialRefId,
      providerId: input.providerId,
      slotKey,
      generation,
    }),
  );

  const result = await client.query<{ generation: number }>(
    `UPDATE security.credential_refs
        SET generation = $6,
            algorithm = $7,
            key_id = $8,
            ciphertext = $9,
            nonce = $10,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND credential_ref_id = $2
        AND provider_id = $3
        AND slot_key = $4
        AND generation = $5
        AND active = true
      RETURNING generation`,
    [
      input.tenantId,
      input.credentialRefId,
      input.providerId,
      slotKey,
      input.expectedGeneration,
      generation,
      envelope.algorithm,
      envelope.keyId,
      envelope.ciphertext,
      envelope.nonce,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "credential.rotation_conflict",
      category: "conflict",
      message: "Credential generation or scope changed before rotation",
      retryable: false,
    });
  }
  return row.generation;
}

export async function revokeProviderCredentialRef(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly credentialRefId: CredentialRefId;
    readonly providerId: ProviderId;
    readonly slotKey: string;
  },
): Promise<boolean> {
  assertIds(input.tenantId, input.credentialRefId, input.providerId);
  const result = await client.query(
    `UPDATE security.credential_refs
        SET active = false,
            updated_at = clock_timestamp()
      WHERE tenant_id = $1
        AND credential_ref_id = $2
        AND provider_id = $3
        AND slot_key = $4
        AND active = true`,
    [
      input.tenantId,
      input.credentialRefId,
      input.providerId,
      normalizeSlotKey(input.slotKey),
    ],
  );
  return result.rowCount === 1;
}

export function createPostgresCredentialMaterialSource(
  client: PoolClient,
  cipher: CredentialEnvelopeCipher,
): CredentialMaterialSource {
  return Object.freeze({
    async resolve(input: CredentialResolutionRequest) {
      const request = normalizeCredentialResolutionRequest(input);
      const result = await client.query<CredentialRow>(
        `SELECT c.tenant_id,
                c.credential_ref_id,
                c.provider_id,
                c.slot_key,
                c.generation,
                c.algorithm,
                c.key_id,
                c.ciphertext,
                c.nonce,
                c.active
           FROM security.credential_refs AS c
           JOIN events.operations AS o
             ON o.tenant_id = c.tenant_id
            AND o.operation_id = $5
          WHERE c.tenant_id = $1
            AND c.credential_ref_id = $2
            AND c.provider_id = $3
            AND c.slot_key = $4
            AND c.active = true`,
        [
          request.tenantId,
          request.credentialRefId,
          request.providerId,
          request.slotKey,
          request.operationId,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      try {
        const secret = await cipher.open({
          envelope: toEnvelope(row),
          tenantId: row.tenant_id,
          credentialRefId: row.credential_ref_id,
          providerId: row.provider_id,
          slotKey: row.slot_key,
          generation: row.generation,
        });
        if (!(secret instanceof CredentialSecret)) {
          throw new TypeError("credential cipher returned invalid secret wrapper");
        }
        return secret;
      } catch {
        throw new PlatformError({
          code: "credential.unavailable",
          category: "authorization",
          message: "Credential reference is unavailable for requested scope",
          retryable: false,
          operationId: request.operationId,
        });
      }
    },
  });
}
