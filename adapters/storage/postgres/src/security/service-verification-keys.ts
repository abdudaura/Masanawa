import { createPublicKey } from "node:crypto";
import type { ServiceId } from "@masanawa/contracts";
import type {
  ServiceCredentialKeySource,
  ServiceCredentialVerificationKey,
} from "@masanawa/security";
import type { PoolClient } from "pg";

interface VerificationKeyRow {
  service_id: ServiceId;
  key_id: string;
  credential_generation: number;
  public_key_pem: string;
  active: boolean;
}

function normalizeEd25519PublicKey(value: string): string {
  const key = createPublicKey(value);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new TypeError("service verification key must be Ed25519");
  }
  return key.export({ type: "spki", format: "pem" }).toString();
}

export async function putServiceVerificationKey(
  client: PoolClient,
  input: {
    readonly serviceId: ServiceId;
    readonly keyId: string;
    readonly credentialGeneration: number;
    readonly publicKeyPem: string;
    readonly active?: boolean;
  },
): Promise<void> {
  const keyId = input.keyId.trim();
  if (!keyId || keyId.length > 128) {
    throw new TypeError("keyId is required and must be at most 128 characters");
  }
  if (
    !Number.isInteger(input.credentialGeneration) ||
    input.credentialGeneration < 1
  ) {
    throw new RangeError("credentialGeneration must be a positive integer");
  }

  const publicKeyPem = normalizeEd25519PublicKey(input.publicKeyPem);
  await client.query(
    `INSERT INTO security.service_credentials (
       service_id,
       key_id,
       credential_generation,
       public_key_pem,
       active
     )
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (service_id, key_id)
     DO UPDATE SET credential_generation = EXCLUDED.credential_generation,
                   public_key_pem = EXCLUDED.public_key_pem,
                   active = EXCLUDED.active,
                   updated_at = clock_timestamp()`,
    [
      input.serviceId,
      keyId,
      input.credentialGeneration,
      publicKeyPem,
      input.active ?? true,
    ],
  );
}

export async function deactivateServiceVerificationKey(
  client: PoolClient,
  serviceId: ServiceId,
  keyId: string,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE security.service_credentials
        SET active = false,
            updated_at = clock_timestamp()
      WHERE service_id = $1
        AND key_id = $2`,
    [serviceId, keyId],
  );
  return result.rowCount === 1;
}

export async function loadServiceVerificationKey(
  client: PoolClient,
  serviceId: ServiceId,
  keyId: string,
): Promise<ServiceCredentialVerificationKey | null> {
  const result = await client.query<VerificationKeyRow>(
    `SELECT service_id,
            key_id,
            credential_generation,
            public_key_pem,
            active
       FROM security.service_credentials
      WHERE service_id = $1
        AND key_id = $2`,
    [serviceId, keyId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return Object.freeze({
    publicKey: createPublicKey(row.public_key_pem),
    credentialGeneration: row.credential_generation,
    active: row.active,
  });
}

export function createPostgresServiceCredentialKeySource(
  client: PoolClient,
): ServiceCredentialKeySource {
  return Object.freeze({
    resolve: (issuer, keyId) =>
      loadServiceVerificationKey(client, issuer, keyId),
  });
}
