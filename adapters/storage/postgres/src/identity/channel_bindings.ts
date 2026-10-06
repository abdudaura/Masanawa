import {
  createChannelAccount,
  createPendingChannelBinding,
  normalizeChannelBindingProof,
  type ChannelAccount,
  type ChannelBindingRepository,
  type CreateChannelAccountInput,
  type CreatePendingChannelBindingInput,
  type UserChannelBinding,
} from "@masanawa/identity";
import { toInstant } from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface ChannelAccountRow {
  tenant_id: ChannelAccount["tenantId"];
  channel_account_id: ChannelAccount["channelAccountId"];
  channel: ChannelAccount["channel"];
  provider_account_ref: string;
  state: ChannelAccount["state"];
  revision: string;
  created_at: Date;
  updated_at: Date;
}

interface ChannelBindingRow {
  tenant_id: UserChannelBinding["tenantId"];
  channel_account_id: UserChannelBinding["channelAccountId"];
  channel: UserChannelBinding["channel"];
  user_id: UserChannelBinding["userId"];
  external_subject_id: string;
  state: UserChannelBinding["state"];
  proof_method: UserChannelBinding["proof"] extends infer _ ? string | null : never;
  proof_evidence_ref: string | null;
  proof_verified_at: Date | null;
  revision: string;
  created_at: Date;
  updated_at: Date;
}

function revision(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid channel binding revision returned by PostgreSQL");
  }
  return parsed;
}

function accountFromRow(row: ChannelAccountRow): ChannelAccount {
  return Object.freeze({
    tenantId: row.tenant_id,
    channelAccountId: row.channel_account_id,
    channel: row.channel,
    providerAccountRef: row.provider_account_ref,
    state: row.state,
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function bindingFromRow(row: ChannelBindingRow): UserChannelBinding {
  const proof =
    row.proof_method === null
      ? null
      : normalizeChannelBindingProof({
          purpose: "account-link",
          method: row.proof_method as NonNullable<UserChannelBinding["proof"]>["method"],
          evidenceRef: row.proof_evidence_ref!,
          verifiedAt: toInstant(row.proof_verified_at!),
        });

  return Object.freeze({
    tenantId: row.tenant_id,
    channelAccountId: row.channel_account_id,
    channel: row.channel,
    userId: row.user_id,
    externalSubjectId: row.external_subject_id,
    state: row.state,
    proof,
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function sameAccount(left: ChannelAccount, right: ChannelAccount): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameBinding(
  left: UserChannelBinding,
  right: UserChannelBinding,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readAccount(
  client: PoolClient,
  input: {
    readonly tenantId: ChannelAccount["tenantId"];
    readonly channelAccountId: ChannelAccount["channelAccountId"];
  },
  forUpdate = false,
): Promise<ChannelAccount | null> {
  const result = await client.query<ChannelAccountRow>(
    `SELECT tenant_id, channel_account_id, channel, provider_account_ref,
            state, revision, created_at, updated_at
       FROM identity.channel_accounts
      WHERE tenant_id=$1 AND channel_account_id=$2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [input.tenantId, input.channelAccountId],
  );
  return result.rows[0] ? accountFromRow(result.rows[0]) : null;
}

async function readBindingBySubject(
  client: PoolClient,
  input: {
    readonly tenantId: UserChannelBinding["tenantId"];
    readonly channelAccountId: UserChannelBinding["channelAccountId"];
    readonly externalSubjectId: string;
  },
  forUpdate = false,
): Promise<UserChannelBinding | null> {
  const result = await client.query<ChannelBindingRow>(
    `SELECT tenant_id, channel_account_id, channel, user_id,
            external_subject_id, state, proof_method, proof_evidence_ref,
            proof_verified_at, revision, created_at, updated_at
       FROM identity.channel_bindings
      WHERE tenant_id=$1
        AND channel_account_id=$2
        AND external_subject_id=$3
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [input.tenantId, input.channelAccountId, input.externalSubjectId.trim()],
  );
  return result.rows[0] ? bindingFromRow(result.rows[0]) : null;
}

async function createAccount(
  client: PoolClient,
  input: CreateChannelAccountInput,
): Promise<ChannelAccount> {
  const canonical = createChannelAccount(input);
  const inserted = await client.query<ChannelAccountRow>(
    `INSERT INTO identity.channel_accounts(
       tenant_id, channel_account_id, channel, provider_account_ref,
       state, revision, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT DO NOTHING
     RETURNING tenant_id, channel_account_id, channel, provider_account_ref,
               state, revision, created_at, updated_at`,
    [
      canonical.tenantId,
      canonical.channelAccountId,
      canonical.channel,
      canonical.providerAccountRef,
      canonical.state,
      canonical.revision,
      canonical.createdAt,
      canonical.updatedAt,
    ],
  );
  if (inserted.rows[0]) return accountFromRow(inserted.rows[0]);

  const existing = await readAccount(client, canonical);
  if (!existing || !sameAccount(existing, canonical)) {
    throw new Error("Channel account create replay conflicted");
  }
  return existing;
}

async function createPendingBinding(
  client: PoolClient,
  input: CreatePendingChannelBindingInput,
): Promise<UserChannelBinding> {
  const storedAccount = await readAccount(client, {
    tenantId: input.account.tenantId,
    channelAccountId: input.account.channelAccountId,
  }, true);
  if (!storedAccount || !sameAccount(storedAccount, input.account)) {
    throw new Error("Channel account is stale or unavailable");
  }
  if (storedAccount.state !== "active") {
    throw new Error("Channel account is not active");
  }

  const canonical = createPendingChannelBinding({
    ...input,
    account: storedAccount,
  });
  const inserted = await client.query<ChannelBindingRow>(
    `INSERT INTO identity.channel_bindings(
       tenant_id, channel_account_id, channel, user_id, external_subject_id,
       state, proof_method, proof_evidence_ref, proof_verified_at,
       revision, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,NULL,$7,$8,$9)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      canonical.tenantId,
      canonical.channelAccountId,
      canonical.channel,
      canonical.userId,
      canonical.externalSubjectId,
      canonical.state,
      canonical.revision,
      canonical.createdAt,
      canonical.updatedAt,
    ],
  );
  if (inserted.rows[0]) return bindingFromRow(inserted.rows[0]);

  const existing = await readBindingBySubject(client, canonical);
  if (!existing || !sameBinding(existing, canonical)) {
    throw new Error("Channel binding create replay conflicted");
  }
  return existing;
}

async function putAccount(
  client: PoolClient,
  input: ChannelAccount,
): Promise<ChannelAccount> {
  const current = await readAccount(client, input, true);
  if (!current) throw new Error("Channel account does not exist");

  if (sameAccount(current, input)) return current;
  if (current.state === "revoked") {
    throw new Error("Revoked channel account is terminal");
  }
  if (input.revision !== current.revision + 1) {
    throw new Error("Channel account revision is stale");
  }
  if (
    input.tenantId !== current.tenantId ||
    input.channelAccountId !== current.channelAccountId ||
    input.channel !== current.channel ||
    input.providerAccountRef !== current.providerAccountRef ||
    input.createdAt !== current.createdAt
  ) {
    throw new Error("Channel account immutable identity changed");
  }
  if (Date.parse(input.updatedAt) < Date.parse(current.updatedAt)) {
    throw new Error("Channel account updatedAt cannot move backwards");
  }

  const result = await client.query<ChannelAccountRow>(
    `UPDATE identity.channel_accounts
        SET state=$3, revision=$4, updated_at=$5
      WHERE tenant_id=$1
        AND channel_account_id=$2
        AND revision=$6
        AND state <> 'revoked'
      RETURNING tenant_id, channel_account_id, channel, provider_account_ref,
                state, revision, created_at, updated_at`,
    [
      input.tenantId,
      input.channelAccountId,
      input.state,
      input.revision,
      input.updatedAt,
      current.revision,
    ],
  );
  if (!result.rows[0]) throw new Error("Channel account revision is stale");
  return accountFromRow(result.rows[0]);
}

async function putBinding(
  client: PoolClient,
  input: UserChannelBinding,
): Promise<UserChannelBinding> {
  const current = await readBindingBySubject(client, input, true);
  if (!current) throw new Error("Channel binding does not exist");

  if (sameBinding(current, input)) return current;
  if (current.state === "revoked") {
    throw new Error("Revoked channel binding is terminal");
  }
  if (input.revision !== current.revision + 1) {
    throw new Error("Channel binding revision is stale");
  }
  if (
    input.tenantId !== current.tenantId ||
    input.channelAccountId !== current.channelAccountId ||
    input.channel !== current.channel ||
    input.userId !== current.userId ||
    input.externalSubjectId !== current.externalSubjectId ||
    input.createdAt !== current.createdAt
  ) {
    throw new Error("Channel binding immutable identity changed");
  }
  if (Date.parse(input.updatedAt) < Date.parse(current.updatedAt)) {
    throw new Error("Channel binding updatedAt cannot move backwards");
  }

  const proof = input.proof === null
    ? null
    : normalizeChannelBindingProof(input.proof);
  if (input.state === "active" && proof === null) {
    throw new Error("Active channel binding requires proof");
  }
  if (input.state === "pending-proof" && proof !== null) {
    throw new Error("Pending channel binding cannot carry proof");
  }

  const result = await client.query<ChannelBindingRow>(
    `UPDATE identity.channel_bindings
        SET state=$4,
            proof_method=$5,
            proof_evidence_ref=$6,
            proof_verified_at=$7,
            revision=$8,
            updated_at=$9
      WHERE tenant_id=$1
        AND channel_account_id=$2
        AND external_subject_id=$3
        AND revision=$10
        AND state <> 'revoked'
      RETURNING *`,
    [
      input.tenantId,
      input.channelAccountId,
      input.externalSubjectId,
      input.state,
      proof?.method ?? null,
      proof?.evidenceRef ?? null,
      proof?.verifiedAt ?? null,
      input.revision,
      input.updatedAt,
      current.revision,
    ],
  );
  if (!result.rows[0]) throw new Error("Channel binding revision is stale");
  return bindingFromRow(result.rows[0]);
}

export function createPostgresChannelBindingRepository(
  pool: Pool,
): ChannelBindingRepository {
  return Object.freeze<ChannelBindingRepository>({
    createAccount: (input) =>
      withTransaction(pool, (client) => createAccount(client, input), {
        isolation: "serializable",
      }),
    readAccount: (input) =>
      withTransaction(pool, (client) => readAccount(client, input), {
        isolation: "repeatable read",
        readOnly: true,
      }),
    createPendingBinding: (input) =>
      withTransaction(pool, (client) => createPendingBinding(client, input), {
        isolation: "serializable",
      }),
    readBindingBySubject: (input) =>
      withTransaction(pool, (client) => readBindingBySubject(client, input), {
        isolation: "repeatable read",
        readOnly: true,
      }),
    readActiveBindingForUser: (input) =>
      withTransaction(
        pool,
        async (client) => {
          const result = await client.query<ChannelBindingRow>(
            `SELECT tenant_id, channel_account_id, channel, user_id,
                    external_subject_id, state, proof_method,
                    proof_evidence_ref, proof_verified_at, revision,
                    created_at, updated_at
               FROM identity.channel_bindings
              WHERE tenant_id=$1
                AND channel_account_id=$2
                AND user_id=$3
                AND state='active'`,
            [input.tenantId, input.channelAccountId, input.userId],
          );
          if (result.rows.length > 1) {
            throw new Error("Multiple active channel bindings violate persistence invariant");
          }
          return result.rows[0] ? bindingFromRow(result.rows[0]) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      ),
    putAccount: (input) =>
      withTransaction(pool, (client) => putAccount(client, input), {
        isolation: "serializable",
      }),
    putBinding: (input) =>
      withTransaction(pool, (client) => putBinding(client, input), {
        isolation: "serializable",
      }),
  });
}
