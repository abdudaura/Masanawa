import type {
  CharacterId,
  LedgerEntryId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import {
  normalizeCommissionPolicy,
  normalizePaidFeatureTrialPolicy,
  type CommissionPolicy,
  type OwnerAccessOffering,
  type OwnerAccessRequest,
  type PaidFeatureKey,
  type PaidFeatureTrialPolicy,
  type TwinAttributionRecord,
  type TwinCreditOperationReceipt,
  type TwinRuntimeRepository,
  type PersistedTwinVoiceAdmission,
  type PersistedTwinVoiceQuote,
} from "@masanawa/commerce";
import { canonicalJson } from "@masanawa/security";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function policyFrom(value: unknown): CommissionPolicy {
  return normalizeCommissionPolicy(value as CommissionPolicy);
}

function trialFrom(value: unknown): PaidFeatureTrialPolicy {
  return normalizePaidFeatureTrialPolicy(value as PaidFeatureTrialPolicy);
}

function requestDefinition(
  value: unknown,
  reservationId: string | null,
  reservedCredits: number,
): OwnerAccessRequest & {
  readonly reservationId: string | null;
  readonly reservedCredits: number;
} {
  return Object.freeze({
    ...(value as OwnerAccessRequest),
    reservationId,
    reservedCredits,
  });
}

export function createPostgresTwinRuntimeRepository(
  pool: Pool,
): TwinRuntimeRepository {
  return Object.freeze<TwinRuntimeRepository>({
    async resolveUserByRecipient(input) {
      const recipient = input.recipient.trim();
      if (!recipient) return null;
      const result = await pool.query<{ user_id: string }>(
        `SELECT user_id
           FROM security.platform_user_profiles
          WHERE tenant_id=$1
            AND (
              user_id=$2
              OR lower(COALESCE(email,''))=lower($2)
              OR phone=$2
            )
          LIMIT 1`,
        [input.tenantId, recipient],
      );
      return (result.rows[0]?.user_id as UserId | undefined) ?? null;
    },

    async readOwnerForCharacter(input) {
      const result = await pool.query<{ owner_user_id: string }>(
        `SELECT owner_user_id
           FROM identity.character_ownership
          WHERE tenant_id=$1 AND character_id=$2
            AND kind='personal-clone' AND owner_user_id IS NOT NULL`,
        [input.tenantId, input.characterId],
      );
      return (result.rows[0]?.owner_user_id as UserId | undefined) ?? null;
    },

    async readCreditOperation(input) {
      const result = await pool.query<{
        tenant_id: string;
        request_id: string;
        kind: "transfer" | "gift";
        sender_user_id: string;
        recipient_user_id: string;
        character_id: string | null;
        amount_credits: string;
        ledger_entry_id: string;
        completed_at: Date | string;
      }>(
        `SELECT tenant_id,request_id,kind,sender_user_id,recipient_user_id,
                character_id,amount_credits::text,ledger_entry_id,completed_at
           FROM commerce.twin_credit_operations
          WHERE tenant_id=$1 AND request_id=$2`,
        [input.tenantId, input.requestId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return Object.freeze({
        tenantId: row.tenant_id as TenantId,
        requestId: row.request_id,
        kind: row.kind,
        senderUserId: row.sender_user_id as UserId,
        recipientUserId: row.recipient_user_id as UserId,
        characterId: row.character_id as CharacterId | null,
        amountCredits: Number(row.amount_credits),
        ledgerEntryId: row.ledger_entry_id as LedgerEntryId,
        completedAt: iso(row.completed_at),
      });
    },

    async recordCreditOperation(input) {
      const inserted = await pool.query(
        `INSERT INTO commerce.twin_credit_operations(
           tenant_id,request_id,kind,sender_user_id,recipient_user_id,
           character_id,amount_credits,ledger_entry_id,completed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (tenant_id,request_id) DO NOTHING`,
        [
          input.tenantId,
          input.requestId,
          input.kind,
          input.senderUserId,
          input.recipientUserId,
          input.characterId,
          input.amountCredits,
          input.ledgerEntryId,
          input.completedAt,
        ],
      );
      const current = await this.readCreditOperation({
        tenantId: input.tenantId,
        requestId: input.requestId,
      });
      if (!current) throw new Error("Twin credit operation persistence failed");
      if (
        current.kind !== input.kind ||
        current.senderUserId !== input.senderUserId ||
        current.recipientUserId !== input.recipientUserId ||
        current.characterId !== input.characterId ||
        current.amountCredits !== input.amountCredits ||
        current.ledgerEntryId !== input.ledgerEntryId
      ) {
        throw new Error("Twin credit operation replay conflict");
      }
      void inserted;
      return current;
    },

    async countOperations(input) {
      const tables =
        input.operation === "credit-transfer" || input.operation === "gift"
          ? {
              sql: `SELECT count(*)::text AS count
                       FROM commerce.twin_credit_operations
                      WHERE tenant_id=$1 AND sender_user_id=$2
                        AND kind=$3 AND completed_at >= $4::timestamptz`,
              params: [
                input.tenantId,
                input.actorUserId,
                input.operation === "gift" ? "gift" : "transfer",
                input.since,
              ],
            }
          : input.operation === "paid-voice"
            ? {
                sql: `SELECT count(*)::text AS count
                         FROM commerce.twin_voice_admissions
                        WHERE tenant_id=$1 AND user_id=$2
                          AND admitted_at >= $3::timestamptz`,
                params: [input.tenantId, input.actorUserId, input.since],
              }
            : {
                sql: `SELECT count(*)::text AS count
                         FROM commerce.owner_access_requests
                        WHERE tenant_id=$1 AND requester_user_id=$2
                          AND created_at >= $3::timestamptz`,
                params: [input.tenantId, input.actorUserId, input.since],
              };
      const result = await pool.query<{ count: string }>(tables.sql, tables.params);
      return Number(result.rows[0]?.count ?? "0");
    },

    async listRecentTransferEdges(input) {
      const result = await pool.query<{
        sender_user_id: string;
        recipient_user_id: string;
        amount_credits: string;
        kind: "transfer" | "gift";
        completed_at: Date | string;
      }>(
        `SELECT sender_user_id,recipient_user_id,amount_credits::text,kind,completed_at
           FROM commerce.twin_credit_operations
          WHERE tenant_id=$1 AND completed_at >= $2::timestamptz
          ORDER BY completed_at DESC
          LIMIT $3`,
        [input.tenantId, input.since, Math.max(1, Math.min(1000, input.limit))],
      );
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            fromUserId: row.sender_user_id,
            toUserId: row.recipient_user_id,
            amountCredits: Number(row.amount_credits),
            kind: row.kind,
            occurredAt: iso(row.completed_at),
          }),
        ),
      );
    },

    async readCommissionPolicy(input) {
      const result = await pool.query<{ definition: unknown }>(
        `SELECT definition
           FROM commerce.twin_commission_policy_revisions
          WHERE tenant_id=$1 AND event_type=$2
            AND effective_at <= $3::timestamptz
          ORDER BY revision DESC
          LIMIT 1`,
        [input.tenantId, input.eventType, input.at],
      );
      return result.rows[0] ? policyFrom(result.rows[0].definition) : null;
    },

    async putCommissionPolicy(input) {
      const policy = normalizeCommissionPolicy(input.policy);
      await pool.query(
        `INSERT INTO commerce.twin_commission_policy_revisions(
           tenant_id,event_type,revision,enabled,rate_basis_points,
           minimum_commission_credits,maximum_commission_credits,
           effective_at,definition
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          policy.eventType,
          policy.revision,
          policy.enabled,
          policy.rateBasisPoints,
          policy.minimumCommissionCredits,
          policy.maximumCommissionCredits,
          policy.effectiveAt,
          canonicalJson(policy),
        ],
      );
      const current = await this.readCommissionPolicy({
        tenantId: input.tenantId,
        eventType: policy.eventType,
        at: policy.effectiveAt,
      });
      if (!current || current.revision !== policy.revision) {
        throw new Error("Commission policy revision conflict");
      }
      return current;
    },

    async putAttribution(input) {
      const a = input.attribution;
      if (a.eventType !== "external-funding" && a.eventType !== "commerce-purchase") {
        throw new Error("Only external funding and commerce purchase attribution is durable");
      }
      await pool.query(
        `INSERT INTO commerce.twin_attributions(
           tenant_id,attribution_id,owner_user_id,character_id,customer_user_id,
           event_type,operation_id,policy_revision,attributed_at,expires_at,
           self_attribution,definition
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (tenant_id,event_type,operation_id) DO NOTHING`,
        [
          input.tenantId,
          a.attributionId,
          a.ownerUserId,
          a.characterId,
          a.customerUserId,
          a.eventType,
          a.operationId,
          a.policyRevision,
          a.attributedAt,
          a.expiresAt,
          a.selfAttribution,
          canonicalJson(a),
        ],
      );
      const current = await this.readAttributionForOperation({
        tenantId: input.tenantId,
        operationId: a.operationId,
        eventType: a.eventType,
      });
      if (!current) throw new Error("Attribution persistence failed");
      if (canonicalJson(current) !== canonicalJson(a)) {
        throw new Error("Attribution replay conflict");
      }
      return current;
    },

    async readAttributionForOperation(input) {
      const result = await pool.query<{ definition: TwinAttributionRecord }>(
        `SELECT definition
           FROM commerce.twin_attributions
          WHERE tenant_id=$1 AND event_type=$2 AND operation_id=$3`,
        [input.tenantId, input.eventType, input.operationId],
      );
      return result.rows[0]
        ? Object.freeze(result.rows[0].definition)
        : null;
    },

    async recordCommissionSettlement(input) {
      const result = await pool.query(
        `INSERT INTO commerce.twin_commission_settlements(
           tenant_id,settlement_id,attribution_id,operation_id,event_type,
           owner_user_id,character_id,base_credits,commission_credits,
           policy_revision,ledger_entry_id,settled_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (tenant_id,operation_id) DO NOTHING`,
        [
          input.tenantId,
          input.settlementId,
          input.attributionId,
          input.operationId,
          input.eventType,
          input.ownerUserId,
          input.characterId,
          input.baseCredits,
          input.commissionCredits,
          input.policyRevision,
          input.ledgerEntryId,
          input.settledAt,
        ],
      );
      return Object.freeze({ duplicate: result.rowCount === 0 });
    },

    async readCommissionForOperation(input) {
      const result = await pool.query<{
        settlement_id: string;
        owner_user_id: string;
        character_id: string;
        base_credits: string;
        commission_credits: string;
        policy_revision: string;
        ledger_entry_id: string;
        reversed_credits: string;
      }>(
        `SELECT settlement_id,owner_user_id,character_id,base_credits::text,
                commission_credits::text,policy_revision::text,ledger_entry_id,reversed_credits::text
           FROM commerce.twin_commission_settlements
          WHERE tenant_id=$1 AND operation_id=$2`,
        [input.tenantId, input.operationId],
      );
      const row = result.rows[0];
      return row
        ? Object.freeze({
            settlementId: row.settlement_id,
            ownerUserId: row.owner_user_id as UserId,
            characterId: row.character_id as CharacterId,
            baseCredits: Number(row.base_credits),
            commissionCredits: Number(row.commission_credits),
            policyRevision: Number(row.policy_revision),
            ledgerEntryId: row.ledger_entry_id as LedgerEntryId,
            reversedCredits: Number(row.reversed_credits),
          })
        : null;
    },

    async recordCommissionReversal(input) {
      return withTransaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO commerce.twin_commission_reversals(
             tenant_id,reversal_id,operation_id,amount_credits,ledger_entry_id,reversed_at
           ) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [
            input.tenantId,
            input.reversalId,
            input.operationId,
            input.amountCredits,
            input.ledgerEntryId,
            input.reversedAt,
          ],
        );
        if (inserted.rowCount === 0) return Object.freeze({ duplicate: true });
        const updated = await client.query(
          `UPDATE commerce.twin_commission_settlements
              SET reversed_credits = reversed_credits + $3
            WHERE tenant_id=$1 AND operation_id=$2
              AND reversed_credits + $3 <= commission_credits`,
          [input.tenantId, input.operationId, input.amountCredits],
        );
        if (updated.rowCount !== 1) throw new Error("Commission reversal exceeds settlement");
        return Object.freeze({ duplicate: false });
      });
    },

    async readTrialPolicy(input) {
      const result = await pool.query<{ definition: unknown }>(
        `SELECT definition
           FROM commerce.paid_feature_trial_policy_revisions
          WHERE tenant_id=$1 AND feature=$2 AND created_at <= $3::timestamptz
          ORDER BY revision DESC
          LIMIT 1`,
        [input.tenantId, input.feature, input.at],
      );
      return result.rows[0] ? trialFrom(result.rows[0].definition) : null;
    },

    async putTrialPolicy(input) {
      const policy = normalizePaidFeatureTrialPolicy(input.policy);
      await pool.query(
        `INSERT INTO commerce.paid_feature_trial_policy_revisions(
           tenant_id,feature,revision,enabled,duration_days,max_units,created_at,definition
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          policy.feature,
          policy.revision,
          policy.enabled,
          policy.durationDays,
          policy.maxUnits,
          policy.createdAt,
          canonicalJson(policy),
        ],
      );
      return policy;
    },

    async readTrialUsage(input) {
      const result = await pool.query<{
        started_at: Date | string | null;
        consumed_units: string;
      }>(
        `SELECT started_at,consumed_units::text
           FROM commerce.paid_feature_trial_usage
          WHERE tenant_id=$1 AND user_id=$2 AND feature=$3`,
        [input.tenantId, input.userId, input.feature],
      );
      return Object.freeze({
        startedAt: result.rows[0]?.started_at
          ? iso(result.rows[0].started_at)
          : null,
        consumedUnits: Number(result.rows[0]?.consumed_units ?? "0"),
      });
    },

    async consumeTrialUsage(input) {
      await withTransaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO commerce.paid_feature_trial_consumptions(
             tenant_id,user_id,feature,policy_revision,idempotency_key,units,consumed_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT DO NOTHING`,
          [
            input.tenantId,
            input.userId,
            input.feature,
            input.policyRevision,
            input.idempotencyKey,
            input.units,
            input.consumedAt,
          ],
        );
        if (inserted.rowCount === 0) return;
        await client.query(
          `INSERT INTO commerce.paid_feature_trial_usage(
             tenant_id,user_id,feature,started_at,consumed_units,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$4)
           ON CONFLICT (tenant_id,user_id,feature) DO UPDATE
             SET started_at=COALESCE(commerce.paid_feature_trial_usage.started_at,EXCLUDED.started_at),
                 consumed_units=commerce.paid_feature_trial_usage.consumed_units+EXCLUDED.consumed_units,
                 updated_at=EXCLUDED.updated_at`,
          [
            input.tenantId,
            input.userId,
            input.feature,
            input.consumedAt,
            input.units,
          ],
        );
      });
    },

    async putVoiceQuote(input) {
      await pool.query(
        `INSERT INTO commerce.twin_voice_quotes(
           tenant_id,quote_id,user_id,owner_user_id,character_id,
           definition,created_at,expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          input.quoteId,
          input.userId,
          input.ownerUserId,
          input.characterId,
          canonicalJson(input),
          input.createdAt,
          input.quoteExpiresAt,
        ],
      );
      const current = await this.readVoiceQuote({
        tenantId: input.tenantId,
        quoteId: input.quoteId,
      });
      if (!current || canonicalJson(current) !== canonicalJson(input)) {
        throw new Error("Voice quote replay conflict");
      }
      return current;
    },

    async readVoiceQuote(input) {
      const result = await pool.query<{ definition: PersistedTwinVoiceQuote }>(
        `SELECT definition FROM commerce.twin_voice_quotes
          WHERE tenant_id=$1 AND quote_id=$2`,
        [input.tenantId, input.quoteId],
      );
      return result.rows[0] ? Object.freeze(result.rows[0].definition) : null;
    },

    async putVoiceAdmission(input) {
      await pool.query(
        `INSERT INTO commerce.twin_voice_admissions(
           tenant_id,admission_id,quote_id,user_id,owner_user_id,character_id,
           charge_mode,spend_cap_credits,reservation_ledger_entry_id,
           admitted_at,started_at,expires_at,settled_at,definition
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          input.admissionId,
          input.quoteId,
          input.userId,
          input.ownerUserId,
          input.characterId,
          input.chargeMode,
          input.spendCapCredits,
          input.reservationLedgerEntryId,
          input.admittedAt,
          input.startedAt,
          input.expiresAt,
          input.settledAt,
          canonicalJson(input),
        ],
      );
      const current = await this.readVoiceAdmission({
        tenantId: input.tenantId,
        admissionId: input.admissionId,
      });
      if (!current) throw new Error("Voice admission persistence failed");
      return current;
    },

    async readVoiceAdmission(input) {
      const result = await pool.query<{
        definition: PersistedTwinVoiceAdmission;
        started_at: Date | string | null;
        settled_at: Date | string | null;
      }>(
        `SELECT definition,started_at,settled_at
           FROM commerce.twin_voice_admissions
          WHERE tenant_id=$1 AND admission_id=$2`,
        [input.tenantId, input.admissionId],
      );
      const row = result.rows[0];
      return row
        ? Object.freeze({
            ...row.definition,
            startedAt: row.started_at ? iso(row.started_at) : null,
            settledAt: row.settled_at ? iso(row.settled_at) : null,
          })
        : null;
    },

    async markVoiceStarted(input) {
      const result = await pool.query(
        `UPDATE commerce.twin_voice_admissions
            SET started_at=COALESCE(started_at,$3)
          WHERE tenant_id=$1 AND admission_id=$2
            AND settled_at IS NULL
          RETURNING admission_id`,
        [input.tenantId, input.admissionId, input.startedAt],
      );
      if (result.rowCount !== 1) throw new Error("Voice admission is unavailable");
      const current = await this.readVoiceAdmission({
        tenantId: input.tenantId,
        admissionId: input.admissionId,
      });
      if (!current) throw new Error("Voice admission is unavailable");
      return current;
    },

    async markVoiceSettled(input) {
      return withTransaction(pool, async (client) => {
        const inserted = await client.query(
          `INSERT INTO commerce.twin_voice_settlements(
             tenant_id,admission_id,outcome,verified_seconds,settlement,settled_at
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)
           ON CONFLICT DO NOTHING`,
          [
            input.tenantId,
            input.admissionId,
            input.outcome,
            input.verifiedSeconds,
            JSON.stringify(input.settlement),
            input.settledAt,
          ],
        );
        if (inserted.rowCount === 0) return Object.freeze({ duplicate: true });
        await client.query(
          `UPDATE commerce.twin_voice_admissions
              SET settled_at=$3
            WHERE tenant_id=$1 AND admission_id=$2 AND settled_at IS NULL`,
          [input.tenantId, input.admissionId, input.settledAt],
        );
        return Object.freeze({ duplicate: false });
      });
    },

    async putOwnerAccessQuote(input) {
      await pool.query(
        `INSERT INTO commerce.owner_access_quotes(
           tenant_id,quote_id,requester_user_id,owner_user_id,character_id,
           definition,created_at,expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          input.quote.requestId,
          input.requesterUserId,
          input.quote.ownerUserId,
          input.quote.originatingCharacterId,
          canonicalJson(input.quote),
          input.createdAt,
          input.quote.quoteExpiresAt,
        ],
      );
      const current = await this.readOwnerAccessQuote({
        tenantId: input.tenantId,
        quoteId: input.quote.requestId,
      });
      if (!current || current.requesterUserId !== input.requesterUserId) {
        throw new Error("Owner access quote persistence failed");
      }
      const { requesterUserId: _requester, ...persisted } = current;
      if (canonicalJson(persisted) !== canonicalJson(input.quote)) {
        throw new Error("Owner access quote replay conflict");
      }
      return Object.freeze(input.quote);
    },

    async readOwnerAccessQuote(input) {
      const result = await pool.query<{
        requester_user_id: string;
        definition: import("@masanawa/commerce").OwnerAccessQuote;
      }>(
        `SELECT requester_user_id,definition
           FROM commerce.owner_access_quotes
          WHERE tenant_id=$1 AND quote_id=$2`,
        [input.tenantId, input.quoteId],
      );
      const row = result.rows[0];
      return row
        ? Object.freeze({
            ...row.definition,
            requesterUserId: row.requester_user_id as UserId,
          })
        : null;
    },

    async readOwnerAccessOffering(input) {
      const result = await pool.query<{ definition: OwnerAccessOffering }>(
        `SELECT definition FROM commerce.owner_access_offerings
          WHERE tenant_id=$1 AND owner_user_id=$2`,
        [input.tenantId, input.ownerUserId],
      );
      return result.rows[0] ? Object.freeze(result.rows[0].definition) : null;
    },

    async putOwnerAccessOffering(input) {
      const offering = input.offering;
      await pool.query(
        `INSERT INTO commerce.owner_access_offerings(
           tenant_id,owner_user_id,character_id,revision,definition,updated_at
         ) VALUES ($1,$2,$3,$4,$5::jsonb,clock_timestamp())
         ON CONFLICT (tenant_id,owner_user_id) DO UPDATE
           SET character_id=EXCLUDED.character_id,
               revision=EXCLUDED.revision,
               definition=EXCLUDED.definition,
               updated_at=clock_timestamp()
         WHERE commerce.owner_access_offerings.revision < EXCLUDED.revision`,
        [
          input.tenantId,
          offering.ownerUserId,
          offering.characterId,
          offering.revision,
          canonicalJson(offering),
        ],
      );
      const current = await this.readOwnerAccessOffering({
        tenantId: input.tenantId,
        ownerUserId: offering.ownerUserId as UserId,
      });
      if (!current) throw new Error("Owner access offering persistence failed");
      return current;
    },

    async putOwnerAccessRequest(input) {
      await pool.query(
        `INSERT INTO commerce.owner_access_requests(
           tenant_id,request_id,requester_user_id,owner_user_id,character_id,state,
           reservation_id,reserved_credits,definition,revision,created_at,updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,1,$10,$10)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          input.request.requestId,
          input.request.requesterUserId,
          input.request.ownerUserId,
          input.request.originatingCharacterId,
          input.request.state,
          input.reservationId,
          input.reservedCredits,
          canonicalJson(input.request),
          input.request.requestedAt,
        ],
      );
      const current = await this.readOwnerAccessRequest({
        tenantId: input.tenantId,
        requestId: input.request.requestId,
      });
      if (!current) throw new Error("Owner access request persistence failed");
      return current;
    },

    async readOwnerAccessRequest(input) {
      const result = await pool.query<{
        definition: OwnerAccessRequest;
        reservation_id: string | null;
        reserved_credits: string;
      }>(
        `SELECT definition,reservation_id,reserved_credits::text
           FROM commerce.owner_access_requests
          WHERE tenant_id=$1 AND request_id=$2`,
        [input.tenantId, input.requestId],
      );
      const row = result.rows[0];
      return row
        ? requestDefinition(
            row.definition,
            row.reservation_id,
            Number(row.reserved_credits),
          )
        : null;
    },

    async updateOwnerAccessRequest(input) {
      const updated = await pool.query<{
        definition: OwnerAccessRequest;
        reservation_id: string | null;
        reserved_credits: string;
      }>(
        `UPDATE commerce.owner_access_requests
            SET state=$3,definition=$4::jsonb,revision=revision+1,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND request_id=$2
          RETURNING definition,reservation_id,reserved_credits::text`,
        [
          input.tenantId,
          input.request.requestId,
          input.request.state,
          canonicalJson(input.request),
        ],
      );
      if (!updated.rows[0]) throw new Error("Owner access request not found");
      return requestDefinition(
        updated.rows[0].definition,
        updated.rows[0].reservation_id,
        Number(updated.rows[0].reserved_credits),
      );
    },

    async blockTwin(input) {
      await pool.query(
        `INSERT INTO commerce.twin_safety_blocks(
           tenant_id,actor_user_id,character_id,blocked_at
         ) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [input.tenantId, input.actorUserId, input.characterId, input.blockedAt],
      );
    },

    async unblockTwin(input) {
      await pool.query(
        `DELETE FROM commerce.twin_safety_blocks
          WHERE tenant_id=$1 AND actor_user_id=$2 AND character_id=$3`,
        [input.tenantId, input.actorUserId, input.characterId],
      );
    },

    async isTwinBlocked(input) {
      const result = await pool.query(
        `SELECT 1 FROM commerce.twin_safety_blocks
          WHERE tenant_id=$1 AND actor_user_id=$2 AND character_id=$3`,
        [input.tenantId, input.actorUserId, input.characterId],
      );
      return result.rowCount === 1;
    },

    async reportTwin(input) {
      await pool.query(
        `INSERT INTO commerce.twin_safety_reports(
           tenant_id,report_id,reporter_user_id,character_id,reason,detail,created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [
          input.tenantId,
          input.reportId,
          input.reporterUserId,
          input.characterId,
          input.reason,
          input.detail,
          input.createdAt,
        ],
      );
    },
  });
}
