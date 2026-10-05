import {
  createCanonicalId,
  nowInstant,
  type CharacterId,
  type CorrelationId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  assertNoTwinTranscriptFields,
  createTwinEconomyEvent,
  type TwinEconomyEventPayload,
} from "@masanawa/events";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";
import { appendPlatformEvent } from "./platform-events.js";

export interface TwinEconomyEventStore {
  append(input: {
    readonly tenantId: TenantId;
    readonly payload: Omit<TwinEconomyEventPayload, "schemaVersion" | "summaryCode">;
    readonly correlationId?: CorrelationId;
  }): Promise<string>;
  listForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly limit: number;
  }): Promise<readonly (TwinEconomyEventPayload & { readonly eventId: string })[]>;
  listForUser(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly limit: number;
  }): Promise<readonly (TwinEconomyEventPayload & { readonly eventId: string })[]>;
}

export function createPostgresTwinEconomyEventStore(
  pool: Pool,
): TwinEconomyEventStore {
  return Object.freeze({
    async append(input) {
      const payload = createTwinEconomyEvent(input.payload);
      assertNoTwinTranscriptFields(payload as unknown as Record<string, unknown>);
      const eventId = createCanonicalId("event");
      const correlationId = input.correlationId ?? createCanonicalId("correlation");
      const at = nowInstant();
      await withTransaction(pool, async (client) => {
        await appendPlatformEvent(client, {
          eventId,
          eventType: payload.eventType,
          schemaVersion: 1,
          tenantId: input.tenantId,
          aggregate: Object.freeze({
            type: "character",
            id: payload.characterId,
          }),
          occurredAt: payload.occurredAt,
          recordedAt: at,
          actor: null,
          authorityRef: null,
          correlationId,
          causationId: null,
          requestId: null,
          workflowRunId: null,
          characterSessionId: null,
          provenance: Object.freeze({ source: "masanawa.twin" }),
          sensitivity:
            payload.visibility === "internal" ? "internal" : "private",
          payload,
        });
      });
      return eventId;
    },

    async listForCharacter(input) {
      const result = await pool.query<{
        event_id: string;
        payload: TwinEconomyEventPayload;
      }>(
        `SELECT event_id,payload
           FROM events.platform_events
          WHERE tenant_id=$1
            AND aggregate_type='character'
            AND aggregate_id=$2
            AND event_type LIKE 'twin.%'
          ORDER BY occurred_at DESC,event_id DESC
          LIMIT $3`,
        [input.tenantId, input.characterId, Math.max(1, Math.min(200, input.limit))],
      );
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            ...createTwinEconomyEvent({
              ...row.payload,
              schemaVersion: undefined as never,
              summaryCode: undefined as never,
            } as never),
            eventId: row.event_id,
          }),
        ),
      );
    },

    async listForUser(input) {
      const result = await pool.query<{
        event_id: string;
        payload: TwinEconomyEventPayload;
      }>(
        `SELECT event_id,payload
           FROM events.platform_events
          WHERE tenant_id=$1
            AND event_type LIKE 'twin.%'
            AND (
              payload->>'ownerUserId'=$2
              OR payload->>'customerUserId'=$2
            )
          ORDER BY occurred_at DESC,event_id DESC
          LIMIT $3`,
        [input.tenantId, input.userId, Math.max(1, Math.min(200, input.limit))],
      );
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({ ...row.payload, eventId: row.event_id }),
        ),
      );
    },
  });
}
