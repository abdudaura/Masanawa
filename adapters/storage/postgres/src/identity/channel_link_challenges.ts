import {
  type ChannelLinkChallenge,
  type ChannelLinkChallengeRepository,
} from "@masanawa/identity";
import {
  parseCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface ChallengeRow {
  request_id: ChannelLinkChallenge["requestId"];
  tenant_id: ChannelLinkChallenge["tenantId"];
  channel_account_id: ChannelLinkChallenge["channelAccountId"];
  channel: ChannelLinkChallenge["channel"];
  user_id: ChannelLinkChallenge["userId"];
  secret_hash: string;
  state: ChannelLinkChallenge["state"];
  attempts: number;
  max_attempts: number;
  revision: string;
  created_at: Date;
  expires_at: Date;
  verified_at: Date | null;
  verified_external_subject_id: string | null;
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function revision(value: string | number): number {
  const parsed = Number(value);
  return integer(parsed, "revision", 1, 1_000_000_000);
}

function challengeFromRow(row: ChallengeRow): ChannelLinkChallenge {
  const maxAttempts = integer(row.max_attempts, "maxAttempts", 1, 10);
  const attempts = integer(row.attempts, "attempts", 0, maxAttempts);
  if (
    row.channel !== "whatsapp" &&
    row.channel !== "telegram"
  ) {
    throw new Error("Invalid channel-link challenge channel returned by PostgreSQL");
  }
  if (
    row.state !== "pending" &&
    row.state !== "verified" &&
    row.state !== "locked" &&
    row.state !== "expired"
  ) {
    throw new Error("Invalid channel-link challenge state returned by PostgreSQL");
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(row.secret_hash)) {
    throw new Error("Invalid channel-link challenge hash returned by PostgreSQL");
  }

  return Object.freeze({
    requestId: parseCanonicalId("request", row.request_id),
    tenantId: parseCanonicalId("tenant", row.tenant_id),
    channelAccountId: parseCanonicalId(
      "channel-account",
      row.channel_account_id,
    ),
    channel: row.channel,
    userId: parseCanonicalId("user", row.user_id),
    secretHash: row.secret_hash,
    state: row.state,
    attempts,
    maxAttempts,
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    expiresAt: toInstant(row.expires_at),
    verifiedAt: row.verified_at === null ? null : toInstant(row.verified_at),
    verifiedExternalSubjectId: row.verified_external_subject_id,
  });
}

function sameChallenge(
  left: ChannelLinkChallenge,
  right: ChannelLinkChallenge,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertImmutableScope(
  current: ChannelLinkChallenge,
  next: ChannelLinkChallenge,
): void {
  if (
    next.requestId !== current.requestId ||
    next.tenantId !== current.tenantId ||
    next.channelAccountId !== current.channelAccountId ||
    next.channel !== current.channel ||
    next.userId !== current.userId ||
    next.secretHash !== current.secretHash ||
    next.maxAttempts !== current.maxAttempts ||
    next.createdAt !== current.createdAt ||
    next.expiresAt !== current.expiresAt
  ) {
    throw new Error("Channel link challenge immutable scope changed");
  }
}

function assertTransition(
  current: ChannelLinkChallenge,
  expectedRevision: number,
  next: ChannelLinkChallenge,
): void {
  if (expectedRevision !== current.revision) {
    throw new Error("Channel link challenge revision is stale");
  }
  if (current.state !== "pending") {
    throw new Error("Channel link challenge terminal state cannot advance");
  }
  if (next.revision !== current.revision + 1) {
    throw new Error("Channel link challenge must advance exactly one revision");
  }

  assertImmutableScope(current, next);

  const attemptDelta = next.attempts - current.attempts;
  if (next.state === "expired") {
    if (attemptDelta !== 0) {
      throw new Error("Expired challenge cannot change attempt count");
    }
  } else if (
    next.state === "pending" ||
    next.state === "verified" ||
    next.state === "locked"
  ) {
    if (attemptDelta !== 1) {
      throw new Error("Channel link verification must record exactly one attempt");
    }
  } else {
    throw new Error("Channel link challenge state is invalid");
  }

  if (next.attempts > next.maxAttempts) {
    throw new Error("Channel link challenge exceeds attempt limit");
  }
  if (next.state === "pending" && next.attempts >= next.maxAttempts) {
    throw new Error("Pending channel link challenge exhausted attempt limit");
  }
  if (next.state === "locked" && next.attempts !== next.maxAttempts) {
    throw new Error("Locked channel link challenge must exhaust attempt limit");
  }

  const createdMs = Date.parse(next.createdAt);
  const expiresMs = Date.parse(next.expiresAt);
  if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs) || expiresMs <= createdMs) {
    throw new Error("Channel link challenge lifetime is invalid");
  }

  if (next.state === "verified") {
    if (
      next.verifiedAt === null ||
      next.verifiedExternalSubjectId === null ||
      next.verifiedExternalSubjectId.trim().length < 1 ||
      next.verifiedExternalSubjectId.trim().length > 512
    ) {
      throw new Error("Verified channel link challenge requires evidence");
    }
    const verifiedMs = Date.parse(next.verifiedAt);
    if (verifiedMs < createdMs || verifiedMs > expiresMs) {
      throw new Error("Channel link verification time is outside challenge lifetime");
    }
  } else if (
    next.verifiedAt !== null ||
    next.verifiedExternalSubjectId !== null
  ) {
    throw new Error("Unverified channel link challenge cannot carry evidence");
  }
}

async function load(
  client: PoolClient,
  requestId: ChannelLinkChallenge["requestId"],
  forUpdate = false,
): Promise<ChannelLinkChallenge | null> {
  const result = await client.query<ChallengeRow>(
    `SELECT request_id, tenant_id, channel_account_id, channel, user_id,
            secret_hash, state, attempts, max_attempts, revision,
            created_at, expires_at, verified_at,
            verified_external_subject_id
       FROM identity.channel_link_challenges
      WHERE request_id=$1
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [requestId],
  );
  return result.rows[0] ? challengeFromRow(result.rows[0]) : null;
}

async function create(
  client: PoolClient,
  challenge: ChannelLinkChallenge,
): Promise<ChannelLinkChallenge> {
  parseCanonicalId("request", challenge.requestId);
  parseCanonicalId("tenant", challenge.tenantId);
  parseCanonicalId("channel-account", challenge.channelAccountId);
  parseCanonicalId("user", challenge.userId);

  if (
    challenge.state !== "pending" ||
    challenge.attempts !== 0 ||
    challenge.revision !== 1 ||
    challenge.verifiedAt !== null ||
    challenge.verifiedExternalSubjectId !== null
  ) {
    throw new Error("New channel link challenge must be initial pending state");
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(challenge.secretHash)) {
    throw new Error("Channel link challenge secretHash is invalid");
  }
  integer(challenge.maxAttempts, "maxAttempts", 1, 10);
  const createdAt = toInstant(challenge.createdAt);
  const expiresAt = toInstant(challenge.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new Error("Channel link challenge expiry must follow creation");
  }

  const inserted = await client.query<ChallengeRow>(
    `INSERT INTO identity.channel_link_challenges(
       request_id, tenant_id, channel_account_id, channel, user_id,
       secret_hash, state, attempts, max_attempts, revision,
       created_at, expires_at, verified_at, verified_external_subject_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,NULL)
     ON CONFLICT (request_id) DO NOTHING
     RETURNING *`,
    [
      challenge.requestId,
      challenge.tenantId,
      challenge.channelAccountId,
      challenge.channel,
      challenge.userId,
      challenge.secretHash,
      challenge.state,
      challenge.attempts,
      challenge.maxAttempts,
      challenge.revision,
      createdAt,
      expiresAt,
    ],
  );
  if (inserted.rows[0]) return challengeFromRow(inserted.rows[0]);

  const existing = await load(client, challenge.requestId);
  if (!existing || !sameChallenge(existing, challenge)) {
    throw new Error("Channel link challenge RequestId replay conflicted");
  }
  return existing;
}

async function compareAndSet(
  client: PoolClient,
  input: {
    readonly requestId: ChannelLinkChallenge["requestId"];
    readonly expectedRevision: number;
    readonly next: ChannelLinkChallenge;
  },
): Promise<ChannelLinkChallenge> {
  const current = await load(client, input.requestId, true);
  if (!current) throw new Error("Channel link challenge does not exist");

  assertTransition(current, input.expectedRevision, input.next);

  const result = await client.query<ChallengeRow>(
    `UPDATE identity.channel_link_challenges
        SET state=$3,
            attempts=$4,
            revision=$5,
            verified_at=$6,
            verified_external_subject_id=$7
      WHERE request_id=$1
        AND revision=$2
        AND state='pending'
      RETURNING *`,
    [
      input.requestId,
      input.expectedRevision,
      input.next.state,
      input.next.attempts,
      input.next.revision,
      input.next.verifiedAt,
      input.next.verifiedExternalSubjectId,
    ],
  );
  if (!result.rows[0]) {
    throw new Error("Channel link challenge revision is stale");
  }
  return challengeFromRow(result.rows[0]);
}

export function createPostgresChannelLinkChallengeRepository(
  pool: Pool,
): ChannelLinkChallengeRepository {
  return Object.freeze<ChannelLinkChallengeRepository>({
    create: ({ challenge }) =>
      withTransaction(pool, (client) => create(client, challenge), {
        isolation: "serializable",
      }),
    load: ({ requestId }) =>
      withTransaction(pool, (client) => load(client, requestId), {
        isolation: "repeatable read",
        readOnly: true,
      }),
    compareAndSet: (input) =>
      withTransaction(pool, (client) => compareAndSet(client, input), {
        isolation: "serializable",
      }),
  });
}
