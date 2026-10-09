import type { Pool, PoolClient } from "@masanawa/postgres";
import {
  assertTalkAiSeatQuote,
  createTalkAiSeatQuote,
  transitionTalkAiSeatQuote,
  type TalkAiSeatQuote,
  type TalkAiSeatSettlementInstruction,
  type TalkAiSeatTransition,
} from "@masanawa/commerce";
import {
  assertTalkLiveSession,
  createTalkLiveSession,
  launchTalkLivePolicy,
  transitionTalkLiveSession,
  type TalkId,
  type TalkLiveSession,
  type TalkPersonaId,
  type TalkSeatId,
} from "@masanawa/agents";
import {
  createCanonicalId,
  parseCanonicalId,
  toInstant,
  type QuoteId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import { canonicalJson } from "@masanawa/security";
import {
  postCommerceTransferWithClient,
  withTransaction,
} from "@masanawa/postgres";
import type {
  TalkAiSeatCandidateRecord,
  TalkAiSeatPricingPolicy,
  TalkAiSeatRepository,
  TalkAiSeatRequestStatus,
} from "./model.js";

interface QuoteRow {
  definition: unknown;
  request_id: string;
}

interface TalkRow {
  host_user_id: string;
  host_name: string;
  state: string;
  started_at: string | Date | null;
  live_state: string | null;
}

interface PersonaRow {
  public_id: string;
  display_name: string;
  kind: "expert" | "twin";
  role: string;
  avatar_url: string | null;
  topics_json: unknown;
  is_available: boolean;
  /** Effective platform moderation, independent of the raw availability flag. */
  safety_allowed: boolean;
  twin_owner_user_id: string | null;
}

interface CanonicalRow {
  revision: number;
  session_json: unknown;
}

function strings(value: unknown): readonly string[] {
  return Object.freeze(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
  );
}

function mapPersona(row: PersonaRow): TalkAiSeatCandidateRecord {
  return Object.freeze({
    personaId: row.public_id,
    displayName: row.display_name,
    kind: row.kind,
    subtitle: row.role || null,
    avatarUrl: row.avatar_url,
    topics: strings(row.topics_json),
    isAvailable:
      row.is_available &&
      row.safety_allowed === true &&
      (row.kind === "expert" || row.twin_owner_user_id !== null),
    twinOwnerUserId: row.twin_owner_user_id,
  });
}

function quoteFromRow(row: QuoteRow): TalkAiSeatQuote {
  const quote = row.definition as TalkAiSeatQuote;
  assertTalkAiSeatQuote(quote);
  return quote;
}

function positiveInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function normalizePricing(policy: TalkAiSeatPricingPolicy): TalkAiSeatPricingPolicy {
  const expertPriceCredits = positiveInteger(
    policy.expertPriceCredits,
    "expertPriceCredits",
    1_000_000_000,
  );
  const twinPriceCredits = positiveInteger(
    policy.twinPriceCredits,
    "twinPriceCredits",
    1_000_000_000,
  );
  const hostShareBasisPoints = positiveInteger(
    policy.hostShareBasisPoints + 1,
    "hostShareBasisPoints",
    10_001,
  ) - 1;
  const twinOwnerShareBasisPoints = positiveInteger(
    policy.twinOwnerShareBasisPoints + 1,
    "twinOwnerShareBasisPoints",
    10_001,
  ) - 1;
  if (hostShareBasisPoints > 10_000 || twinOwnerShareBasisPoints > 10_000) {
    throw new RangeError("AI Seat share basis points are invalid");
  }
  if (hostShareBasisPoints + twinOwnerShareBasisPoints > 10_000) {
    throw new RangeError("Twin AI Seat shares exceed 100%");
  }
  const quoteTtlSeconds = positiveInteger(
    policy.quoteTtlSeconds,
    "quoteTtlSeconds",
    3600,
  );
  return Object.freeze({
    expertPriceCredits,
    twinPriceCredits,
    hostShareBasisPoints,
    twinOwnerShareBasisPoints,
    quoteTtlSeconds,
  });
}

function economics(
  kind: "expert" | "twin",
  policyInput: TalkAiSeatPricingPolicy,
): Readonly<{
  priceCredits: number;
  hostShareCredits: number;
  twinOwnerShareCredits: number;
  platformShareCredits: number;
}> {
  const policy = normalizePricing(policyInput);
  const priceCredits =
    kind === "expert" ? policy.expertPriceCredits : policy.twinPriceCredits;
  const hostShareCredits = Math.floor(
    (priceCredits * policy.hostShareBasisPoints) / 10_000,
  );
  const twinOwnerShareCredits =
    kind === "twin"
      ? Math.floor((priceCredits * policy.twinOwnerShareBasisPoints) / 10_000)
      : 0;
  return Object.freeze({
    priceCredits,
    hostShareCredits,
    twinOwnerShareCredits,
    platformShareCredits:
      priceCredits - hostShareCredits - twinOwnerShareCredits,
  });
}

async function readTalk(
  client: PoolClient,
  tenantId: string,
  talkId: string,
  lock = false,
): Promise<TalkRow | null> {
  const result = await client.query<TalkRow>(
    `SELECT t.host_user_id,t.host_name,t.state,t.started_at,
            lr.state AS live_state
       FROM talks.talks t
       LEFT JOIN talks.live_runtime lr
         ON lr.tenant_id=t.tenant_id AND lr.talk_id=t.talk_id
      WHERE t.tenant_id=$1 AND t.talk_id=$2
      LIMIT 1 ${lock ? "FOR UPDATE OF t" : ""}`,
    [tenantId, talkId],
  );
  return result.rows[0] ?? null;
}

function requireLiveTalk(talk: TalkRow | null): TalkRow {
  if (!talk) throw new Error("talks.not_found");
  if (talk.state !== "live" || talk.live_state !== "live") {
    throw new Error("talks.not_live");
  }
  return talk;
}

/** Transaction guard shared with talks.safety_enforcement writes. */
async function guardPersonaSafety(
  client: PoolClient,
  tenantId: string,
  personaId: string,
): Promise<void> {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1::text),hashtext($2::text))`,
    [tenantId, personaId],
  );
}

async function readPersona(
  client: PoolClient,
  tenantId: string,
  personaId: string,
): Promise<PersonaRow | null> {
  const result = await client.query<PersonaRow>(
    `SELECT p.public_id,p.display_name,p.kind,p.role,p.avatar_url,
            p.topics_json,p.is_available,owner.user_id AS twin_owner_user_id,
            NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id=p.tenant_id AND se.target_kind='persona'
                 AND se.target_id=p.public_id
                 AND se.visibility IN ('restricted','blocked')
            ) AS safety_allowed
       FROM talks.persona_profiles p
       LEFT JOIN talks.public_profiles owner
         ON owner.tenant_id=p.tenant_id AND owner.handle=p.owner_handle
      WHERE p.tenant_id=$1 AND p.public_id=$2
      LIMIT 1`,
    [tenantId, personaId],
  );
  return result.rows[0] ?? null;
}

async function loadCanonical(
  client: PoolClient,
  tenantId: string,
  talkId: string,
  talk: TalkRow,
  now: string,
): Promise<TalkLiveSession> {
  const existing = await client.query<CanonicalRow>(
    `SELECT revision,session_json
       FROM talks.live_canonical
      WHERE tenant_id=$1 AND talk_id=$2
      FOR UPDATE`,
    [tenantId, talkId],
  );
  if (existing.rows[0]) {
    const session = existing.rows[0].session_json as TalkLiveSession;
    assertTalkLiveSession(session, launchTalkLivePolicy);
    return session;
  }

  const startedAt = toInstant(
    talk.started_at === null
      ? now
      : talk.started_at instanceof Date
        ? talk.started_at.toISOString()
        : new Date(talk.started_at).toISOString(),
  );
  const created = createTalkLiveSession(
    {
      tenantId: parseCanonicalId("tenant", tenantId),
      talkId: talkId as TalkId,
      hostUserId: parseCanonicalId("user", talk.host_user_id),
      hostSeatId: `host_${talk.host_user_id}` as TalkSeatId,
      startedAt,
    },
    launchTalkLivePolicy,
  );
  await client.query(
    `INSERT INTO talks.live_canonical(
       tenant_id,talk_id,revision,session_json,updated_at
     ) VALUES($1,$2,$3,$4::jsonb,$5)
     ON CONFLICT(tenant_id,talk_id) DO NOTHING`,
    [tenantId, talkId, created.revision, canonicalJson(created), now],
  );
  const reread = await client.query<CanonicalRow>(
    `SELECT revision,session_json
       FROM talks.live_canonical
      WHERE tenant_id=$1 AND talk_id=$2
      FOR UPDATE`,
    [tenantId, talkId],
  );
  const session = reread.rows[0]?.session_json as TalkLiveSession | undefined;
  if (!session) throw new Error("talks.canonical_missing");
  assertTalkLiveSession(session, launchTalkLivePolicy);
  return session;
}

function transfer(
  quote: TalkAiSeatQuote,
  input: Readonly<{
    debitKind:
      | "customer-credit"
      | "platform-float";
    debitUserId: UserId | null;
    creditKind:
      | "customer-credit"
      | "platform-float"
      | "pending-earnings"
      | "platform-revenue";
    creditUserId: UserId | null;
    amountCredits: number;
    reason: "customer-payment" | "creator-earning" | "platform-margin" | "refund";
    at: string;
  }>,
) {
  return Object.freeze({
    schemaVersion: 1 as const,
    ledgerEntryId: createCanonicalId("ledger-entry"),
    tenantId: quote.tenantId,
    debit: Object.freeze({
      tenantId: quote.tenantId,
      kind: input.debitKind,
      userId: input.debitUserId,
      characterId: null,
    }),
    credit: Object.freeze({
      tenantId: quote.tenantId,
      kind: input.creditKind,
      userId: input.creditUserId,
      characterId: null,
    }),
    amountCredits: input.amountCredits,
    reason: input.reason,
    quoteId: quote.quoteId,
    fulfillmentId: null,
    createdAt: toInstant(input.at),
  });
}

async function applySettlement(
  client: PoolClient,
  quote: TalkAiSeatQuote,
  instruction: TalkAiSeatSettlementInstruction | null,
  at: string,
): Promise<void> {
  if (!instruction) return;

  if (instruction.kind === "hold") {
    await postCommerceTransferWithClient(
      client,
      transfer(quote, {
        debitKind: "customer-credit",
        debitUserId: instruction.payerUserId,
        creditKind: "platform-float",
        creditUserId: null,
        amountCredits: instruction.amountCredits,
        reason: "customer-payment",
        at,
      }),
    );
    return;
  }

  if (instruction.kind === "release") {
    await postCommerceTransferWithClient(
      client,
      transfer(quote, {
        debitKind: "platform-float",
        debitUserId: null,
        creditKind: "customer-credit",
        creditUserId: instruction.payerUserId,
        amountCredits: instruction.amountCredits,
        reason: "refund",
        at,
      }),
    );
    return;
  }

  if (instruction.hostShareCredits > 0) {
    await postCommerceTransferWithClient(
      client,
      transfer(quote, {
        debitKind: "platform-float",
        debitUserId: null,
        creditKind: "pending-earnings",
        creditUserId: instruction.hostUserId,
        amountCredits: instruction.hostShareCredits,
        reason: "creator-earning",
        at,
      }),
    );
  }
  if (
    instruction.twinOwnerUserId !== null &&
    instruction.twinOwnerShareCredits > 0
  ) {
    await postCommerceTransferWithClient(
      client,
      transfer(quote, {
        debitKind: "platform-float",
        debitUserId: null,
        creditKind: "pending-earnings",
        creditUserId: instruction.twinOwnerUserId,
        amountCredits: instruction.twinOwnerShareCredits,
        reason: "creator-earning",
        at,
      }),
    );
  }
  if (instruction.platformShareCredits > 0) {
    await postCommerceTransferWithClient(
      client,
      transfer(quote, {
        debitKind: "platform-float",
        debitUserId: null,
        creditKind: "platform-revenue",
        creditUserId: null,
        amountCredits: instruction.platformShareCredits,
        reason: "platform-margin",
        at,
      }),
    );
  }
}

async function persistQuote(
  client: PoolClient,
  previous: TalkAiSeatQuote,
  updated: TalkAiSeatQuote,
  now: string,
): Promise<void> {
  const result = await client.query(
    `UPDATE commerce.talk_ai_seat_quotes
        SET definition=$4::jsonb,updated_at=$5
      WHERE tenant_id=$1 AND quote_id=$2
        AND (definition->>'revision')::bigint=$3`,
    [
      previous.tenantId,
      previous.quoteId,
      previous.revision,
      canonicalJson(updated),
      now,
    ],
  );
  if (result.rowCount !== 1) throw new Error("AI Seat quote revision conflict");
}

async function appendActivity(
  client: PoolClient,
  input: Readonly<{
    tenantId: string;
    activityId: string;
    userId: string;
    kind:
      | "ai_seat_sponsored"
      | "ai_seat_accepted"
      | "ai_seat_declined"
      | "earning";
    title: string;
    detail: string;
    createdAt: string;
    talkId: string;
    personaId: string;
    transactionId?: string;
    amountLabel?: string;
    requiresAction?: boolean;
    actionLabel?: string;
  }>,
): Promise<void> {
  await client.query(
    `INSERT INTO talks.activity(
       tenant_id,activity_id,user_id,kind,title,detail,created_at,
       talk_id,profile_public_id,persona_id,transaction_id,amount_label,
       requires_action,action_label,unread
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13,true)
     ON CONFLICT(tenant_id,activity_id) DO UPDATE
       SET title=EXCLUDED.title,
           detail=EXCLUDED.detail,
           transaction_id=EXCLUDED.transaction_id,
           amount_label=EXCLUDED.amount_label,
           requires_action=EXCLUDED.requires_action,
           action_label=EXCLUDED.action_label,
           unread=true
     WHERE talks.activity.user_id=EXCLUDED.user_id
       AND talks.activity.kind=EXCLUDED.kind`,
    [
      input.tenantId,
      input.activityId,
      input.userId,
      input.kind,
      input.title,
      input.detail,
      input.createdAt,
      input.talkId,
      input.personaId,
      input.transactionId ?? null,
      input.amountLabel ?? null,
      input.requiresAction ?? false,
      input.actionLabel ?? null,
    ],
  );
}

async function resolveSponsorActivity(
  client: PoolClient,
  quote: TalkAiSeatQuote,
): Promise<void> {
  await client.query(
    `UPDATE talks.activity
        SET requires_action=false,action_label=NULL
      WHERE tenant_id=$1
        AND activity_id=$2`,
    [quote.tenantId, `ai-seat:${quote.quoteId}:sponsor-host`],
  );
}

async function captureActivities(
  client: PoolClient,
  quote: TalkAiSeatQuote,
  displayName: string,
  at: string,
): Promise<void> {
  await appendActivity(client, {
    tenantId: quote.tenantId,
    activityId: `ai-seat:${quote.quoteId}:accepted-payer`,
    userId: quote.payerUserId,
    kind: "ai_seat_accepted",
    title: "AI Seat admitted",
    detail: `${displayName} joined the Talk.`,
    createdAt: at,
    talkId: quote.talkId,
    personaId: quote.personaId,
    transactionId: quote.quoteId,
    amountLabel: `${quote.priceCredits} Credits`,
  });

  if (quote.hostShareCredits > 0) {
    await appendActivity(client, {
      tenantId: quote.tenantId,
      activityId: `ai-seat:${quote.quoteId}:earning-host`,
      userId: quote.hostUserId,
      kind: "earning",
      title: "Talk Seat earning",
      detail: `You earned from ${displayName}'s AI Seat.`,
      createdAt: at,
      talkId: quote.talkId,
      personaId: quote.personaId,
      transactionId: quote.quoteId,
      amountLabel: `${quote.hostShareCredits} Credits`,
    });
  }
  if (quote.twinOwnerUserId !== null && quote.twinOwnerShareCredits > 0) {
    await appendActivity(client, {
      tenantId: quote.tenantId,
      activityId: `ai-seat:${quote.quoteId}:earning-twin-owner`,
      userId: quote.twinOwnerUserId,
      kind: "earning",
      title: "Twin Seat earning",
      detail: `Your Twin earned a Seat in a live Talk.`,
      createdAt: at,
      talkId: quote.talkId,
      personaId: quote.personaId,
      transactionId: quote.quoteId,
      amountLabel: `${quote.twinOwnerShareCredits} Credits`,
    });
  }
}

async function releaseActivities(
  client: PoolClient,
  quote: TalkAiSeatQuote,
  displayName: string,
  at: string,
  status: "declined" | "expired",
): Promise<void> {
  await appendActivity(client, {
    tenantId: quote.tenantId,
    activityId: `ai-seat:${quote.quoteId}:released-payer`,
    userId: quote.payerUserId,
    kind: "ai_seat_declined",
    title: status === "expired" ? "AI Seat request expired" : "AI Seat declined",
    detail:
      status === "expired"
        ? `${displayName} was not admitted before the request expired. Your held Credits were released.`
        : `${displayName} was not admitted. Your held Credits were released.`,
    createdAt: at,
    talkId: quote.talkId,
    personaId: quote.personaId,
    transactionId: quote.quoteId,
    amountLabel: `${quote.priceCredits} Credits`,
  });
}

async function admitAiSeat(
  client: PoolClient,
  quote: TalkAiSeatQuote,
  requestId: string,
  displayName: string,
  avatarUrl: string | null,
  now: string,
): Promise<TalkLiveSession> {
  const talk = requireLiveTalk(
    await readTalk(client, quote.tenantId, quote.talkId, true),
  );
  if (talk.host_user_id !== quote.hostUserId) {
    throw new Error("talks.host_identity_changed");
  }

  const session = await loadCanonical(
    client,
    quote.tenantId,
    quote.talkId,
    talk,
    now,
  );
  const seatId = `seat_${requestId}` as TalkSeatId;
  if (session.seats.some((seat) => seat.seatId === seatId)) return session;

  const transitioned = transitionTalkLiveSession(
    session,
    {
      type: "ai_seat_admitted",
      expectedRevision: session.revision,
      seatId,
      kind: quote.personaKind,
      personaId: quote.personaId as TalkPersonaId,
      commercialAuthorizationId: quote.quoteId,
    },
    toInstant(now),
    launchTalkLivePolicy,
  );

  const applied = await client.query(
    `UPDATE talks.live_canonical
        SET revision=$4,session_json=$5::jsonb,updated_at=$6
      WHERE tenant_id=$1 AND talk_id=$2 AND revision=$3`,
    [
      quote.tenantId,
      quote.talkId,
      session.revision,
      transitioned.session.revision,
      canonicalJson(transitioned.session),
      now,
    ],
  );
  if (applied.rowCount !== 1) throw new Error("Talk live revision conflict");

  await client.query(
    `INSERT INTO talks.talk_seats(
       tenant_id,talk_id,participant_id,kind,user_id,persona_id,display_name,
       avatar_url,is_host,is_muted,active,admitted_at,removed_at
     ) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,false,false,true,$8,NULL)
     ON CONFLICT(tenant_id,talk_id,participant_id) DO UPDATE
       SET active=true,is_muted=false,removed_at=NULL`,
    [
      quote.tenantId,
      quote.talkId,
      seatId,
      quote.personaKind,
      quote.personaId,
      displayName,
      avatarUrl,
      now,
    ],
  );
  return transitioned.session;
}

async function readLockedQuote(
  client: PoolClient,
  tenantId: string,
  quoteId: string,
): Promise<Readonly<{ quote: TalkAiSeatQuote; requestId: string }> | null> {
  const result = await client.query<QuoteRow>(
    `SELECT definition,request_id
       FROM commerce.talk_ai_seat_quotes
      WHERE tenant_id=$1 AND quote_id=$2
      FOR UPDATE`,
    [tenantId, quoteId],
  );
  const row = result.rows[0];
  return row
    ? Object.freeze({ quote: quoteFromRow(row), requestId: row.request_id })
    : null;
}

function currentStatus(quote: TalkAiSeatQuote): TalkAiSeatRequestStatus | null {
  switch (quote.state) {
    case "pending_host":
      return "pending_host";
    case "admitted":
      return "admitted";
    case "declined":
      return "declined";
    case "expired":
      return "expired";
    case "quoted":
    case "pending_admission":
      return null;
  }
}

export function createPostgresTalkAiSeatRepository(
  pool: Pool,
): TalkAiSeatRepository {
  return Object.freeze<TalkAiSeatRepository>({
    async listCandidates(input) {
      return withTransaction(
        pool,
        async (client) => {
          requireLiveTalk(await readTalk(client, input.tenantId, input.talkId));
          const result = await client.query<PersonaRow>(
            `SELECT p.public_id,p.display_name,p.kind,p.role,p.avatar_url,
                    p.topics_json,p.is_available,owner.user_id AS twin_owner_user_id,
                    TRUE AS safety_allowed
               FROM talks.persona_profiles p
               LEFT JOIN talks.public_profiles owner
                 ON owner.tenant_id=p.tenant_id AND owner.handle=p.owner_handle
              WHERE p.tenant_id=$1
                AND NOT EXISTS (
                  SELECT 1 FROM talks.safety_enforcement se
                   WHERE se.tenant_id=p.tenant_id AND se.target_kind='persona'
                     AND se.target_id=p.public_id
                     AND se.visibility IN ('restricted','blocked')
                )
              ORDER BY p.is_available DESC,p.is_verified DESC,p.display_name,p.public_id
              LIMIT 100`,
            [input.tenantId],
          );
          return Object.freeze(result.rows.map(mapPersona));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async createQuote(input) {
      return withTransaction(pool, async (client) => {
        const talk = requireLiveTalk(
          await readTalk(client, input.tenantId, input.talkId, true),
        );
        await guardPersonaSafety(client, input.tenantId, input.personaId);
        const personaRow = await readPersona(
          client,
          input.tenantId,
          input.personaId,
        );
        if (!personaRow) throw new Error("talks.persona_not_found");
        const persona = mapPersona(personaRow);
        if (!persona.isAvailable) throw new Error("talks.persona_unavailable");

        const policy = normalizePricing(input.pricing);
        const split = economics(persona.kind, policy);
        const createdAt = toInstant(input.now);
        const expiresAt = toInstant(
          new Date(
            Date.parse(createdAt) + policy.quoteTtlSeconds * 1000,
          ).toISOString(),
        );
        const quoteId = createCanonicalId("quote");
        const requestId = createCanonicalId("request");
        const quote = createTalkAiSeatQuote({
          tenantId: parseCanonicalId("tenant", input.tenantId),
          quoteId,
          talkId: input.talkId,
          personaId: persona.personaId,
          personaKind: persona.kind,
          mode: input.mode,
          payerUserId: parseCanonicalId("user", input.payerUserId),
          hostUserId: parseCanonicalId("user", talk.host_user_id),
          twinOwnerUserId:
            persona.twinOwnerUserId === null
              ? null
              : parseCanonicalId("user", persona.twinOwnerUserId),
          ...split,
          createdAt,
          expiresAt,
        });
        await client.query(
          `INSERT INTO commerce.talk_ai_seat_quotes(
             tenant_id,quote_id,talk_id,persona_id,request_id,definition,
             created_at,expires_at,updated_at
           ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$7)`,
          [
            input.tenantId,
            quoteId,
            input.talkId,
            persona.personaId,
            requestId,
            canonicalJson(quote),
            createdAt,
            expiresAt,
          ],
        );
        return Object.freeze({
          quote,
          requestId,
          displayName: persona.displayName,
        });
      });
    },

    async confirm(input) {
      return withTransaction(pool, async (client) => {
        const locked = await readLockedQuote(
          client,
          input.tenantId,
          input.quoteId,
        );
        if (
          !locked ||
          locked.quote.talkId !== input.talkId ||
          locked.quote.payerUserId !== input.payerUserId
        ) {
          throw new Error("talks.ai_seat_quote_not_found");
        }
        await guardPersonaSafety(client, input.tenantId, locked.quote.personaId);
        const personaRow = await readPersona(
          client,
          input.tenantId,
          locked.quote.personaId,
        );
        if (!personaRow) throw new Error("talks.persona_not_found");
        const displayName = personaRow.display_name;
        const existingStatus = currentStatus(locked.quote);
        if (existingStatus) {
          return Object.freeze({
            requestId: locked.requestId,
            status: existingStatus,
            displayName,
          });
        }

        if (locked.quote.state === "quoted" && input.now >= locked.quote.expiresAt) {
          const expired = transitionTalkAiSeatQuote(
            locked.quote,
            {
              type: "expire",
              requestId: `expire:${locked.requestId}`,
              expectedRevision: locked.quote.revision,
            },
            toInstant(input.now),
          );
          await persistQuote(client, locked.quote, expired.quote, input.now);
          return Object.freeze({
            requestId: locked.requestId,
            status: "expired" as const,
            displayName,
          });
        }

        // A quote that was valid before moderation is not permission to charge.
        // Keep terminal/expired reads above intact for existing receipts.
        if (!mapPersona(personaRow).isAvailable) {
          throw new Error("talks.persona_unavailable");
        }

        let transition = transitionTalkAiSeatQuote(
          locked.quote,
          {
            type: "confirm",
            requestId: `confirm:${locked.requestId}`,
            expectedRevision: locked.quote.revision,
            actorUserId: parseCanonicalId("user", input.payerUserId),
          },
          toInstant(input.now),
        );
        await applySettlement(
          client,
          locked.quote,
          transition.settlement,
          input.now,
        );

        if (transition.quote.mode === "sponsor") {
          await client.query(
            `INSERT INTO talks.host_requests(
               tenant_id,talk_id,request_id,kind,requester_user_id,persona_id,
               display_name,detail,avatar_url,amount_label,
               commercial_authorization_id,status,created_at,updated_at
             ) VALUES(
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$12
             )
             ON CONFLICT(tenant_id,talk_id,request_id) DO NOTHING`,
            [
              input.tenantId,
              input.talkId,
              locked.requestId,
              transition.quote.personaKind === "expert"
                ? "sponsored_expert"
                : "sponsored_twin",
              input.payerUserId,
              transition.quote.personaId,
              displayName,
              personaRow.role || null,
              personaRow.avatar_url,
              `${transition.quote.priceCredits} Credits`,
              transition.quote.quoteId,
              input.now,
            ],
          );
          await persistQuote(
            client,
            locked.quote,
            transition.quote,
            input.now,
          );
          await appendActivity(client, {
            tenantId: input.tenantId,
            activityId: `ai-seat:${transition.quote.quoteId}:sponsor-host`,
            userId: transition.quote.hostUserId,
            kind: "ai_seat_sponsored",
            title: "AI Seat sponsorship",
            detail: `${displayName} was sponsored for your Talk.`,
            createdAt: input.now,
            talkId: input.talkId,
            personaId: transition.quote.personaId,
            transactionId: transition.quote.quoteId,
            amountLabel: `${transition.quote.priceCredits} Credits`,
            requiresAction: true,
            actionLabel: "Review",
          });
          return Object.freeze({
            requestId: locked.requestId,
            status: "pending_host" as const,
            displayName,
          });
        }

        const confirmed = transition.quote;
        const admitted = transitionTalkAiSeatQuote(
          confirmed,
          {
            type: "admit",
            requestId: `admit:${locked.requestId}`,
            expectedRevision: confirmed.revision,
            actorUserId: confirmed.hostUserId,
          },
          toInstant(input.now),
        );
        await admitAiSeat(
          client,
          admitted.quote,
          locked.requestId,
          displayName,
          personaRow.avatar_url,
          input.now,
        );
        await applySettlement(
          client,
          confirmed,
          admitted.settlement,
          input.now,
        );
        await persistQuote(client, locked.quote, admitted.quote, input.now);
        await captureActivities(
          client,
          admitted.quote,
          displayName,
          input.now,
        );
        return Object.freeze({
          requestId: locked.requestId,
          status: "admitted" as const,
          displayName,
        });
      });
    },

    async hostDecision(input) {
      return withTransaction(pool, async (client) => {
        const request = await client.query<{
          commercial_authorization_id: string | null;
          kind: string;
          status: string;
        }>(
          `SELECT commercial_authorization_id,kind,status
             FROM talks.host_requests
            WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3
            FOR UPDATE`,
          [input.tenantId, input.talkId, input.requestId],
        );
        const requestRow = request.rows[0];
        if (
          !requestRow ||
          !["sponsored_expert", "sponsored_twin"].includes(requestRow.kind)
        ) {
          return Object.freeze({ handled: false });
        }
        if (!requestRow.commercial_authorization_id) {
          throw new Error("talks.ai_commerce_required");
        }

        const locked = await readLockedQuote(
          client,
          input.tenantId,
          requestRow.commercial_authorization_id,
        );
        if (
          !locked ||
          locked.requestId !== input.requestId ||
          locked.quote.talkId !== input.talkId
        ) {
          throw new Error("talks.ai_commerce_required");
        }
        if (locked.quote.hostUserId !== input.hostUserId) {
          throw new Error("talks.host_forbidden");
        }
        await guardPersonaSafety(client, input.tenantId, locked.quote.personaId);
        const personaRow = await readPersona(
          client,
          input.tenantId,
          locked.quote.personaId,
        );
        if (!personaRow) throw new Error("talks.persona_not_found");
        const displayName = personaRow.display_name;

        const terminal = currentStatus(locked.quote);
        if (terminal && terminal !== "pending_host") {
          return Object.freeze({ handled: true, status: terminal });
        }

        if (input.now >= locked.quote.expiresAt) {
          const expired = transitionTalkAiSeatQuote(
            locked.quote,
            {
              type: "expire",
              requestId: `expire:${input.requestId}`,
              expectedRevision: locked.quote.revision,
            },
            toInstant(input.now),
          );
          await applySettlement(
            client,
            locked.quote,
            expired.settlement,
            input.now,
          );
          await persistQuote(
            client,
            locked.quote,
            expired.quote,
            input.now,
          );
          await client.query(
            `UPDATE talks.host_requests
                SET status='withdrawn',updated_at=$4
              WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3`,
            [input.tenantId, input.talkId, input.requestId, input.now],
          );
          await resolveSponsorActivity(client, locked.quote);
          await releaseActivities(
            client,
            expired.quote,
            displayName,
            input.now,
            "expired",
          );
          return Object.freeze({
            handled: true,
            status: "expired" as const,
          });
        }

        // A sponsored request held before moderation must release funds
        // through the canonical decline transition, never admit the persona.
        if (input.action === "decline" || !mapPersona(personaRow).isAvailable) {
          const declined = transitionTalkAiSeatQuote(
            locked.quote,
            {
              type: "decline",
              requestId: `decline:${input.requestId}`,
              expectedRevision: locked.quote.revision,
              actorUserId: parseCanonicalId("user", input.hostUserId),
            },
            toInstant(input.now),
          );
          await applySettlement(
            client,
            locked.quote,
            declined.settlement,
            input.now,
          );
          await persistQuote(
            client,
            locked.quote,
            declined.quote,
            input.now,
          );
          await client.query(
            `UPDATE talks.host_requests
                SET status='declined',updated_at=$4
              WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3`,
            [input.tenantId, input.talkId, input.requestId, input.now],
          );
          await resolveSponsorActivity(client, locked.quote);
          await releaseActivities(
            client,
            declined.quote,
            displayName,
            input.now,
            "declined",
          );
          return Object.freeze({
            handled: true,
            status: "declined" as const,
          });
        }

        const admitted = transitionTalkAiSeatQuote(
          locked.quote,
          {
            type: "admit",
            requestId: `admit:${input.requestId}`,
            expectedRevision: locked.quote.revision,
            actorUserId: parseCanonicalId("user", input.hostUserId),
          },
          toInstant(input.now),
        );
        await admitAiSeat(
          client,
          admitted.quote,
          input.requestId,
          displayName,
          personaRow.avatar_url,
          input.now,
        );
        await applySettlement(
          client,
          locked.quote,
          admitted.settlement,
          input.now,
        );
        await persistQuote(
          client,
          locked.quote,
          admitted.quote,
          input.now,
        );
        await client.query(
          `UPDATE talks.host_requests
              SET status='accepted',updated_at=$4
            WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3`,
          [input.tenantId, input.talkId, input.requestId, input.now],
        );
        await resolveSponsorActivity(client, locked.quote);
        await captureActivities(
          client,
          admitted.quote,
          displayName,
          input.now,
        );
        return Object.freeze({
          handled: true,
          status: "admitted" as const,
        });
      });
    },

    async readRuntimeSeat(input) {
      const seatId = `seat_${input.requestId}`;
      const result = await pool.query<{
        tenant_id: string;
        talk_id: string;
        participant_id: string;
        persona_id: string;
        kind: "expert" | "twin";
      }>(
        `SELECT tenant_id,talk_id,participant_id,persona_id,kind
           FROM talks.talk_seats
          WHERE tenant_id=$1
            AND talk_id=$2
            AND participant_id=$3
            AND kind IN ('expert','twin')
            AND active=TRUE
            AND removed_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id=talks.talk_seats.tenant_id
                 AND se.target_kind='persona'
                 AND se.target_id=talks.talk_seats.persona_id
                 AND se.visibility IN ('restricted','blocked')
            )
          LIMIT 1`,
        [input.tenantId, input.talkId, seatId],
      );
      const row = result.rows[0];
      return row
        ? Object.freeze({
            tenantId: row.tenant_id,
            talkId: row.talk_id,
            seatId: row.participant_id,
            personaId: row.persona_id,
            kind: row.kind,
          })
        : null;
    },

    async sweepExpired(input) {
      return withTransaction(pool, async (client) => {
        const due = await client.query<QuoteRow>(
          `SELECT definition,request_id
             FROM commerce.talk_ai_seat_quotes
            WHERE tenant_id=$1
              AND talk_id=$2
              AND definition->>'state'='pending_host'
              AND expires_at <= $3
            ORDER BY expires_at,quote_id
            LIMIT $4
            FOR UPDATE SKIP LOCKED`,
          [input.tenantId, input.talkId, input.now, input.limit],
        );
        let count = 0;
        for (const row of due.rows) {
          const quote = quoteFromRow(row);
          const personaRow = await readPersona(
            client,
            input.tenantId,
            quote.personaId,
          );
          const displayName = personaRow?.display_name ?? "AI Seat";
          const expired: TalkAiSeatTransition = transitionTalkAiSeatQuote(
            quote,
            {
              type: "expire",
              requestId: `expire:${row.request_id}`,
              expectedRevision: quote.revision,
            },
            toInstant(input.now),
          );
          await applySettlement(client, quote, expired.settlement, input.now);
          await persistQuote(client, quote, expired.quote, input.now);
          await client.query(
            `UPDATE talks.host_requests
                SET status='withdrawn',updated_at=$4
              WHERE tenant_id=$1 AND talk_id=$2 AND request_id=$3
                AND status='pending'`,
            [input.tenantId, input.talkId, row.request_id, input.now],
          );
          await resolveSponsorActivity(client, quote);
          await releaseActivities(
            client,
            expired.quote,
            displayName,
            input.now,
            "expired",
          );
          count += 1;
        }
        return count;
      });
    },
  });
}

