import {
  assertFulfillmentAdmissionTransfers,
  planFulfillmentSettlement,
  normalizeCommerceAccountRef,
  normalizeCommerceFulfillmentAdmission,
  normalizeCommerceFulfillmentCompletion,
  normalizeCommerceLedgerTransfer,
  normalizeCommerceQuote,
  normalizeOfferRevision,
  type CommerceAccountRef,
  type CommerceFulfillmentAdmission,
  type CommerceFulfillmentCompletion,
  type CommerceLedgerTransfer,
  type CommerceQuote,
  type CommerceRepository,
  type OfferRevision,
} from "@masanawa/commerce";
import { canonicalJson } from "@masanawa/security";
import { PlatformError } from "@masanawa/contracts";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({ code, category: "conflict", message, retryable: false });
}

function offerFromDefinition(value: unknown): OfferRevision {
  return normalizeOfferRevision(value as OfferRevision);
}

function quoteFromDefinition(value: unknown): CommerceQuote {
  return normalizeCommerceQuote(value as CommerceQuote);
}

function transferFromDefinition(value: unknown): CommerceLedgerTransfer {
  return normalizeCommerceLedgerTransfer(value as CommerceLedgerTransfer);
}

function fulfillmentFromDefinition(value: unknown): CommerceFulfillmentAdmission {
  return normalizeCommerceFulfillmentAdmission(
    value as CommerceFulfillmentAdmission,
  );
}

function completionFromDefinition(value: unknown): CommerceFulfillmentCompletion {
  return normalizeCommerceFulfillmentCompletion(
    value as CommerceFulfillmentCompletion,
  );
}

const protectedDebitKinds = new Set<CommerceAccountRef["kind"]>([
  "customer-credit",
  "agent-float",
  "fulfillment-reserve",
  "pending-earnings",
  "available-earnings",
]);

async function readBalanceWithClient(
  client: import("pg").PoolClient,
  account: CommerceAccountRef,
): Promise<number> {
  const result = await client.query<{ balance: string }>(
    `SELECT
       COALESCE(SUM(
         CASE
           WHEN credit_kind = $2
            AND credit_user_id IS NOT DISTINCT FROM $3
            AND credit_character_id IS NOT DISTINCT FROM $4
           THEN amount_credits
           WHEN debit_kind = $2
            AND debit_user_id IS NOT DISTINCT FROM $3
            AND debit_character_id IS NOT DISTINCT FROM $4
           THEN -amount_credits
           ELSE 0
         END
       ),0)::text AS balance
       FROM commerce.ledger_entries
      WHERE tenant_id = $1`,
    [account.tenantId, account.kind, account.userId, account.characterId],
  );
  const balance = Number(result.rows[0]?.balance ?? "0");
  if (!Number.isSafeInteger(balance)) {
    throw new Error("Commerce balance exceeds safe integer range");
  }
  return balance;
}

async function postTransferWithClient(
  client: import("pg").PoolClient,
  transferInput: CommerceLedgerTransfer,
): Promise<CommerceLedgerTransfer> {
  const transfer = normalizeCommerceLedgerTransfer(transferInput);
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `commerce:ledger:${transfer.tenantId}:${transfer.ledgerEntryId}`,
  ]);

  const existing = await client.query<{ definition: CommerceLedgerTransfer }>(
    "SELECT definition FROM commerce.ledger_entries WHERE tenant_id=$1 AND ledger_entry_id=$2",
    [transfer.tenantId, transfer.ledgerEntryId],
  );
  if (existing.rows[0]) {
    const replay = transferFromDefinition(existing.rows[0].definition);
    if (canonicalJson(replay) !== canonicalJson(transfer)) {
      throw conflict(
        "commerce.ledger_replay_conflict",
        "Ledger identity replayed with different content",
      );
    }
    return replay;
  }

  if (protectedDebitKinds.has(transfer.debit.kind)) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `commerce:account:${transfer.debit.tenantId}:${transfer.debit.kind}:${transfer.debit.userId ?? "-"}:${transfer.debit.characterId ?? "-"}`,
    ]);
    const balance = await readBalanceWithClient(client, transfer.debit);
    if (balance < transfer.amountCredits) {
      throw conflict(
        "commerce.insufficient_balance",
        "Commerce account does not have enough Credits for this transfer",
      );
    }
  }

  const inserted = await client.query<{ definition: CommerceLedgerTransfer }>(
    `INSERT INTO commerce.ledger_entries(
       tenant_id, ledger_entry_id,
       debit_kind, debit_user_id, debit_character_id,
       credit_kind, credit_user_id, credit_character_id,
       amount_credits, reason, quote_id, fulfillment_id, created_at, definition
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     RETURNING definition`,
    [
      transfer.tenantId, transfer.ledgerEntryId,
      transfer.debit.kind, transfer.debit.userId, transfer.debit.characterId,
      transfer.credit.kind, transfer.credit.userId, transfer.credit.characterId,
      transfer.amountCredits, transfer.reason, transfer.quoteId,
      transfer.fulfillmentId, transfer.createdAt, canonicalJson(transfer),
    ],
  );
  return transferFromDefinition(inserted.rows[0]!.definition);
}

export function createPostgresCommerceRepository(pool: Pool): CommerceRepository {
  return Object.freeze<CommerceRepository>({
    async registerOfferRevision(input) {
      const offer = normalizeOfferRevision(input);
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `commerce:offer:${offer.tenantId}:${offer.offerId}`,
        ]);
        await client.query(
          `INSERT INTO commerce.offers(tenant_id, offer_id, key, created_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (tenant_id, offer_id) DO NOTHING`,
          [offer.tenantId, offer.offerId, offer.key, offer.createdAt],
        );
        const logical = await client.query<{ key: string }>(
          "SELECT key FROM commerce.offers WHERE tenant_id = $1 AND offer_id = $2",
          [offer.tenantId, offer.offerId],
        );
        if (logical.rows[0]?.key !== offer.key) {
          throw conflict("commerce.offer_identity_conflict", "Offer identity is already bound to another key");
        }
        const inserted = await client.query<{ definition: OfferRevision }>(
          `INSERT INTO commerce.offer_revisions(
             tenant_id, offer_id, revision, definition, created_at
           ) VALUES ($1,$2,$3,$4::jsonb,$5)
           ON CONFLICT (tenant_id, offer_id, revision) DO NOTHING
           RETURNING definition`,
          [offer.tenantId, offer.offerId, offer.revision, canonicalJson(offer), offer.createdAt],
        );
        if (!inserted.rows[0]) {
          const existing = await client.query<{ definition: OfferRevision }>(
            `SELECT definition FROM commerce.offer_revisions
              WHERE tenant_id = $1 AND offer_id = $2 AND revision = $3`,
            [offer.tenantId, offer.offerId, offer.revision],
          );
          const normalized = offerFromDefinition(existing.rows[0]?.definition);
          if (canonicalJson(normalized) !== canonicalJson(offer)) {
            throw conflict("commerce.offer_revision_conflict", "Offer revision already exists with different content");
          }
        }
        await client.query(
          `INSERT INTO commerce.offer_heads(tenant_id, offer_id, current_revision, enabled, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tenant_id, offer_id) DO UPDATE
             SET current_revision = EXCLUDED.current_revision,
                 enabled = EXCLUDED.enabled,
                 updated_at = EXCLUDED.updated_at
           WHERE commerce.offer_heads.current_revision < EXCLUDED.current_revision`,
          [offer.tenantId, offer.offerId, offer.revision, offer.active, offer.createdAt],
        );
        return offer;
      });
    },

    async readOfferRevision(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: OfferRevision }>(
          `SELECT definition FROM commerce.offer_revisions
            WHERE tenant_id = $1 AND offer_id = $2 AND revision = $3`,
          [input.tenantId, input.offerId, input.revision],
        );
        return result.rows[0] ? offerFromDefinition(result.rows[0].definition) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async readActiveOfferByKey(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<{ definition: OfferRevision }>(
          `SELECT r.definition
             FROM commerce.offers o
             JOIN commerce.offer_heads h
               ON h.tenant_id = o.tenant_id AND h.offer_id = o.offer_id
             JOIN commerce.offer_revisions r
               ON r.tenant_id = h.tenant_id
              AND r.offer_id = h.offer_id
              AND r.revision = h.current_revision
            WHERE o.tenant_id = $1 AND o.key = $2 AND h.enabled = true`,
          [input.tenantId, input.key.trim().toLowerCase()],
        );
        return result.rows[0] ? offerFromDefinition(result.rows[0].definition) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async listActiveOffers(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: OfferRevision }>(
            `SELECT r.definition
               FROM commerce.offer_heads h
               JOIN commerce.offer_revisions r
                 ON r.tenant_id = h.tenant_id
                AND r.offer_id = h.offer_id
                AND r.revision = h.current_revision
              WHERE h.tenant_id = $1 AND h.enabled = true
              ORDER BY r.definition ->> 'title', h.offer_id`,
            [input.tenantId],
          );
          return Object.freeze(
            result.rows.map((row) => offerFromDefinition(row.definition)),
          );
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async createQuote(input) {
      const quote = normalizeCommerceQuote(input);
      return withTransaction(pool, async (client) => {
        const inserted = await client.query<{ definition: CommerceQuote }>(
          `INSERT INTO commerce.quotes(
             tenant_id, quote_id, definition, created_at, expires_at
           ) VALUES ($1,$2,$3::jsonb,$4,$5)
           ON CONFLICT DO NOTHING
           RETURNING definition`,
          [quote.tenantId, quote.quoteId, canonicalJson(quote), quote.createdAt, quote.expiresAt],
        );
        if (inserted.rows[0]) return quoteFromDefinition(inserted.rows[0].definition);
        const existing = await client.query<{ definition: CommerceQuote }>(
          "SELECT definition FROM commerce.quotes WHERE tenant_id=$1 AND quote_id=$2",
          [quote.tenantId, quote.quoteId],
        );
        const replay = quoteFromDefinition(existing.rows[0]?.definition);
        if (canonicalJson(replay) !== canonicalJson(quote)) {
          throw conflict("commerce.quote_replay_conflict", "Quote identity replayed with different content");
        }
        return replay;
      });
    },

    async readQuote(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: CommerceQuote }>(
            "SELECT definition FROM commerce.quotes WHERE tenant_id=$1 AND quote_id=$2",
            [input.tenantId, input.quoteId],
          );
          return result.rows[0] ? quoteFromDefinition(result.rows[0].definition) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async readFulfillmentForQuote(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: CommerceFulfillmentAdmission }>(
            "SELECT definition FROM commerce.fulfillments WHERE tenant_id=$1 AND quote_id=$2",
            [input.tenantId, input.quoteId],
          );
          return result.rows[0]
            ? fulfillmentFromDefinition(result.rows[0].definition)
            : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async admitFulfillment(input) {
      const admission = normalizeCommerceFulfillmentAdmission(input.admission);
      const transfers = input.transfers.map(normalizeCommerceLedgerTransfer);
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `commerce:quote-admission:${admission.tenantId}:${admission.quoteId}`,
        ]);

        const existing = await client.query<{ definition: CommerceFulfillmentAdmission }>(
          "SELECT definition FROM commerce.fulfillments WHERE tenant_id=$1 AND quote_id=$2",
          [admission.tenantId, admission.quoteId],
        );
        if (existing.rows[0]) {
          return fulfillmentFromDefinition(existing.rows[0].definition);
        }

        const quoted = await client.query<{ definition: CommerceQuote }>(
          "SELECT definition FROM commerce.quotes WHERE tenant_id=$1 AND quote_id=$2 FOR SHARE",
          [admission.tenantId, admission.quoteId],
        );
        if (!quoted.rows[0]) {
          throw conflict("commerce.quote_unavailable", "Fulfillment quote is unavailable");
        }
        const quote = quoteFromDefinition(quoted.rows[0].definition);
        if (Date.parse(quote.expiresAt) <= Date.now()) {
          throw conflict("commerce.quote_expired", "Fulfillment quote has expired");
        }
        assertFulfillmentAdmissionTransfers({ quote, admission, transfers });

        const inserted = await client.query<{ definition: CommerceFulfillmentAdmission }>(
          `INSERT INTO commerce.fulfillments(
             tenant_id, fulfillment_id, quote_id, definition, created_at
           ) VALUES ($1,$2,$3,$4::jsonb,$5)
           RETURNING definition`,
          [
            admission.tenantId,
            admission.fulfillmentId,
            admission.quoteId,
            canonicalJson(admission),
            admission.createdAt,
          ],
        );

        for (const transfer of transfers) {
          if (
            transfer.tenantId !== admission.tenantId ||
            transfer.quoteId !== admission.quoteId ||
            transfer.fulfillmentId !== admission.fulfillmentId
          ) {
            throw conflict(
              "commerce.fulfillment_transfer_mismatch",
              "Fulfillment admission transfer does not match admission identity",
            );
          }
          await postTransferWithClient(client, transfer);
        }

        return fulfillmentFromDefinition(inserted.rows[0]!.definition);
      });
    },

    async readFulfillment(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: CommerceFulfillmentAdmission }>(
            "SELECT definition FROM commerce.fulfillments WHERE tenant_id=$1 AND fulfillment_id=$2",
            [input.tenantId, input.fulfillmentId],
          );
          return result.rows[0]
            ? fulfillmentFromDefinition(result.rows[0].definition)
            : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async readFulfillmentCompletion(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: CommerceFulfillmentCompletion }>(
            "SELECT definition FROM commerce.fulfillment_completions WHERE tenant_id=$1 AND fulfillment_id=$2",
            [input.tenantId, input.fulfillmentId],
          );
          return result.rows[0]
            ? completionFromDefinition(result.rows[0].definition)
            : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async completeFulfillment(input) {
      const completion = normalizeCommerceFulfillmentCompletion(
        input.completion,
      );
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `commerce:fulfillment-completion:${completion.tenantId}:${completion.fulfillmentId}`,
        ]);

        const existing = await client.query<{ definition: CommerceFulfillmentCompletion }>(
          "SELECT definition FROM commerce.fulfillment_completions WHERE tenant_id=$1 AND fulfillment_id=$2",
          [completion.tenantId, completion.fulfillmentId],
        );
        if (existing.rows[0]) {
          const replay = completionFromDefinition(existing.rows[0].definition);
          if (canonicalJson(replay) !== canonicalJson(completion)) {
            throw conflict(
              "commerce.fulfillment_completion_conflict",
              "Fulfillment already completed with different receipt evidence",
            );
          }
          return replay;
        }

        const admitted = await client.query<{ definition: CommerceFulfillmentAdmission }>(
          "SELECT definition FROM commerce.fulfillments WHERE tenant_id=$1 AND fulfillment_id=$2 FOR SHARE",
          [completion.tenantId, completion.fulfillmentId],
        );
        if (!admitted.rows[0]) {
          throw conflict(
            "commerce.fulfillment_not_admitted",
            "Fulfillment must be admitted before completion",
          );
        }

        const admission = fulfillmentFromDefinition(admitted.rows[0].definition);
        const quoted = await client.query<{ definition: CommerceQuote }>(
          "SELECT definition FROM commerce.quotes WHERE tenant_id=$1 AND quote_id=$2 FOR SHARE",
          [admission.tenantId, admission.quoteId],
        );
        if (!quoted.rows[0]) {
          throw conflict("commerce.quote_unavailable", "Fulfillment quote is unavailable");
        }
        const transfers = planFulfillmentSettlement({
          quote: quoteFromDefinition(quoted.rows[0].definition), admission, completion,
        });

        const inserted = await client.query<{ definition: CommerceFulfillmentCompletion }>(
          `INSERT INTO commerce.fulfillment_completions(
             tenant_id, fulfillment_id, definition, completed_at
           ) VALUES ($1,$2,$3::jsonb,$4)
           RETURNING definition`,
          [
            completion.tenantId,
            completion.fulfillmentId,
            canonicalJson(completion),
            completion.completedAt,
          ],
        );

        for (const transfer of transfers) {
          if (
            transfer.tenantId !== completion.tenantId ||
            transfer.fulfillmentId !== completion.fulfillmentId
          ) {
            throw conflict(
              "commerce.fulfillment_settlement_mismatch",
              "Settlement transfer does not match fulfillment completion",
            );
          }
          await postTransferWithClient(client, transfer);
        }

        return completionFromDefinition(inserted.rows[0]!.definition);
      });
    },

    async postTransfer(input) {
      return withTransaction(
        pool,
        (client) => postTransferWithClient(client, input),
      );
    },

    async readBalance(input) {
      const account = normalizeCommerceAccountRef(input);
      return withTransaction(
        pool,
        (client) => readBalanceWithClient(client, account),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async readCreatorCommercialSnapshot(input) {
      const refs: readonly CommerceAccountRef[] = [
        { tenantId: input.tenantId, kind: "agent-float", userId: input.userId, characterId: input.characterId },
        { tenantId: input.tenantId, kind: "pending-earnings", userId: input.userId, characterId: null },
        { tenantId: input.tenantId, kind: "available-earnings", userId: input.userId, characterId: null },
      ];
      const balances = await withTransaction(
        pool,
        async (client) =>
          Promise.all(
            refs.map((ref) =>
              readBalanceWithClient(client, normalizeCommerceAccountRef(ref)),
            ),
          ),
        { isolation: "repeatable read", readOnly: true },
      );
      const [agentFloatCredits, pendingEarningsCredits, availableEarningsCredits] =
        balances;
      return Object.freeze({
        agentFloatCredits: agentFloatCredits ?? 0,
        pendingEarningsCredits: pendingEarningsCredits ?? 0,
        availableEarningsCredits: availableEarningsCredits ?? 0,
      });
    },
  });
}
