import type { TenantId } from "@masanawa/contracts";
import type { AgentAdminAuthorizer } from "./agent_admin.js";

export interface PlatformAdminQuery {
  query<T extends object = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ readonly rows: readonly T[]; readonly rowCount?: number | null }>;
}

export interface PlatformAdminSummary {
  readonly users: number;
  readonly characters: number;
  readonly activeSessions: number;
  readonly runningAgentRuns: number;
  readonly enabledOffers: number;
  readonly admittedFulfillments: number;
  readonly completedFulfillments: number;
  readonly openReconciliationCases: number;
  readonly activeProviderCredentials: number;
}

export interface PlatformAdminCharacter {
  readonly characterId: string;
  readonly state: "active" | "disabled" | "archived";
  readonly activeCharacterVersionId: string | null;
  readonly revision: number;
  readonly configuredInUserApp: boolean;
  readonly visibleInUserApp: boolean | null;
  readonly displayName: string | null;
  readonly roleLabel: string | null;
  readonly updatedAt: string;
}

export interface PlatformAdminUser {
  readonly userId: string;
  readonly state: "active" | "disabled" | "archived";
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly identityCount: number;
  readonly relationshipCount: number;
}

export interface PlatformAdminAgentRun {
  readonly agentRunId: string;
  readonly userId: string;
  readonly characterId: string;
  readonly characterSessionId: string;
  readonly state: "running" | "completed" | "failed";
  readonly failureCode: string | null;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly correlationId: string;
}

export interface PlatformAdminOffer {
  readonly offerId: string;
  readonly key: string;
  readonly revision: number;
  readonly enabled: boolean;
  readonly updatedAt: string;
}

export interface PlatformAdminFulfillment {
  readonly fulfillmentId: string;
  readonly quoteId: string;
  readonly state: "admitted" | "succeeded";
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface PlatformAdminLedgerEntry {
  readonly ledgerEntryId: string;
  readonly debitKind: string;
  readonly debitUserId: string | null;
  readonly debitCharacterId: string | null;
  readonly creditKind: string;
  readonly creditUserId: string | null;
  readonly creditCharacterId: string | null;
  readonly amountCredits: number;
  readonly reason: string;
  readonly quoteId: string | null;
  readonly fulfillmentId: string | null;
  readonly createdAt: string;
}

export interface PlatformAdminOperation {
  readonly operationId: string;
  readonly kind: string;
  readonly state: string;
  readonly attempt: number;
  readonly provider: string | null;
  readonly terminalErrorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformAdminReconciliationCase {
  readonly reconciliationCaseId: string;
  readonly operationId: string;
  readonly status: string;
  readonly reasonCode: string;
  readonly safeRetry: boolean;
  readonly nextAction: string | null;
  readonly openedAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
}

export interface PlatformAdminCredentialRef {
  readonly credentialRefId: string;
  readonly providerId: string;
  readonly slotKey: string;
  readonly generation: number;
  readonly algorithm: string;
  readonly keyId: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformAdminAuditEvent {
  readonly auditEventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly correlationId: string;
  readonly sensitivity: string;
}

export interface PlatformAdminService {
  summary(input: { readonly authorizationHeader: string | undefined }): Promise<PlatformAdminSummary>;
  listCharacters(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly PlatformAdminCharacter[]>;
  listUsers(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
    readonly state?: PlatformAdminUser["state"];
  }): Promise<readonly PlatformAdminUser[]>;
  setUserState(input: {
    readonly authorizationHeader: string | undefined;
    readonly userId: string;
    readonly state: PlatformAdminUser["state"];
    readonly expectedRevision: number;
  }): Promise<PlatformAdminUser>;
  listAgentRuns(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
    readonly state?: PlatformAdminAgentRun["state"];
  }): Promise<readonly PlatformAdminAgentRun[]>;
  listOffers(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly PlatformAdminOffer[]>;
  listFulfillments(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly PlatformAdminFulfillment[]>;
  listLedger(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly PlatformAdminLedgerEntry[]>;
  listOperations(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
    readonly state?: string;
  }): Promise<readonly PlatformAdminOperation[]>;
  listReconciliation(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
    readonly status?: string;
  }): Promise<readonly PlatformAdminReconciliationCase[]>;
  listCredentialRefs(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly PlatformAdminCredentialRef[]>;
  listAuditEvents(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly PlatformAdminAuditEvent[]>;
}

function boundedLimit(value: number | undefined): number {
  if (value === undefined) return 100;
  if (!Number.isInteger(value) || value < 1) return 100;
  return Math.min(value, 500);
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tenant(authority: { readonly tenantId: TenantId }): TenantId {
  return authority.tenantId;
}

export function createPlatformAdminService(input: {
  readonly database: PlatformAdminQuery;
  readonly authorizer: AgentAdminAuthorizer;
}): PlatformAdminService {
  const authorize = async (
    authorizationHeader: string | undefined,
    capability:
      | "platform.summary.read"
      | "identity.users.read"
      | "identity.users.write"
      | "agents.runs.read"
      | "commerce.read"
      | "operations.read"
      | "reconciliation.read"
      | "providers.credentials.read"
      | "audit.read",
  ) => input.authorizer.authorize({ authorizationHeader, capability });

  return Object.freeze<PlatformAdminService>({
    async summary(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "platform.summary.read",
      );
      const result = await input.database.query<{
        users: string | number;
        characters: string | number;
        active_sessions: string | number;
        running_agent_runs: string | number;
        enabled_offers: string | number;
        admitted_fulfillments: string | number;
        completed_fulfillments: string | number;
        open_reconciliation_cases: string | number;
        active_provider_credentials: string | number;
      }>(
        `SELECT
          (SELECT count(*) FROM identity.users WHERE tenant_id = $1) AS users,
          (SELECT count(*) FROM identity.characters WHERE tenant_id = $1) AS characters,
          (SELECT count(*) FROM agents.character_sessions WHERE tenant_id = $1 AND state = 'active') AS active_sessions,
          (SELECT count(*) FROM agents.agent_runs WHERE tenant_id = $1 AND state = 'running') AS running_agent_runs,
          (SELECT count(*) FROM commerce.offer_heads WHERE tenant_id = $1 AND enabled) AS enabled_offers,
          (SELECT count(*) FROM commerce.fulfillments WHERE tenant_id = $1) AS admitted_fulfillments,
          (SELECT count(*) FROM commerce.fulfillment_completions WHERE tenant_id = $1) AS completed_fulfillments,
          (SELECT count(*) FROM events.reconciliation_cases WHERE tenant_id = $1 AND status IN ('open','checking','needs-attention')) AS open_reconciliation_cases,
          (SELECT count(*) FROM security.credential_refs WHERE tenant_id = $1 AND active) AS active_provider_credentials`,
        [tenant(authority)],
      );
      const row = result.rows[0]!;
      return {
        users: numberValue(row.users),
        characters: numberValue(row.characters),
        activeSessions: numberValue(row.active_sessions),
        runningAgentRuns: numberValue(row.running_agent_runs),
        enabledOffers: numberValue(row.enabled_offers),
        admittedFulfillments: numberValue(row.admitted_fulfillments),
        completedFulfillments: numberValue(row.completed_fulfillments),
        openReconciliationCases: numberValue(row.open_reconciliation_cases),
        activeProviderCredentials: numberValue(row.active_provider_credentials),
      };
    },

    async listCharacters(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "agents.presentation.read",
      );
      const result = await input.database.query<{
        character_id: string;
        state: PlatformAdminCharacter["state"];
        active_character_version_id: string | null;
        revision: string | number;
        display_name: string | null;
        role_label: string | null;
        visible_in_user_app: boolean | null;
        updated_at: Date | string;
      }>(
        `SELECT c.character_id, c.state, c.active_character_version_id,
                c.revision, p.display_name, p.role_label,
                p.visible_in_user_app, c.updated_at
           FROM identity.characters c
           LEFT JOIN agents.agent_presentations p
             ON p.tenant_id = c.tenant_id
            AND p.character_id = c.character_id
          WHERE c.tenant_id = $1
          ORDER BY c.updated_at DESC
          LIMIT $2`,
        [tenant(authority), boundedLimit(request.limit)],
      );
      return result.rows.map((row) => ({
        characterId: row.character_id,
        state: row.state,
        activeCharacterVersionId: row.active_character_version_id,
        revision: numberValue(row.revision),
        configuredInUserApp: row.display_name !== null,
        visibleInUserApp: row.visible_in_user_app,
        displayName: row.display_name,
        roleLabel: row.role_label,
        updatedAt: iso(row.updated_at),
      }));
    },

    async listUsers(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "identity.users.read",
      );
      const values: unknown[] = [tenant(authority), boundedLimit(request.limit)];
      const stateClause = request.state ? "AND u.state = $3" : "";
      if (request.state) values.push(request.state);
      const result = await input.database.query<{
        user_id: string;
        state: PlatformAdminUser["state"];
        revision: string | number;
        created_at: Date | string;
        updated_at: Date | string;
        identity_count: string | number;
        relationship_count: string | number;
      }>(
        `SELECT u.user_id, u.state, u.revision, u.created_at, u.updated_at,
                count(DISTINCT e.subject_value) AS identity_count,
                count(DISTINCT r.relationship_id) AS relationship_count
           FROM identity.users u
           LEFT JOIN identity.external_user_identities e
             ON e.tenant_id = u.tenant_id AND e.user_id = u.user_id
           LEFT JOIN identity.relationships r
             ON r.tenant_id = u.tenant_id AND r.user_id = u.user_id
          WHERE u.tenant_id = $1
            ${stateClause}
          GROUP BY u.user_id, u.state, u.revision, u.created_at, u.updated_at
          ORDER BY u.updated_at DESC
          LIMIT $2`,
        values,
      );
      return result.rows.map((row) => ({
        userId: row.user_id,
        state: row.state,
        revision: numberValue(row.revision),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        identityCount: numberValue(row.identity_count),
        relationshipCount: numberValue(row.relationship_count),
      }));
    },

    async setUserState(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "identity.users.write",
      );
      const result = await input.database.query<{
        user_id: string;
        state: PlatformAdminUser["state"];
        revision: string | number;
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `UPDATE identity.users
            SET state = $4,
                revision = revision + 1,
                updated_at = clock_timestamp()
          WHERE tenant_id = $1
            AND user_id = $2
            AND revision = $3
          RETURNING user_id, state, revision, created_at, updated_at`,
        [
          tenant(authority),
          request.userId,
          request.expectedRevision,
          request.state,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error("User state changed or user was not found");
      }
      const counts = await input.database.query<{
        identity_count: string | number;
        relationship_count: string | number;
      }>(
        `SELECT
          (SELECT count(*) FROM identity.external_user_identities
            WHERE tenant_id = $1 AND user_id = $2) AS identity_count,
          (SELECT count(*) FROM identity.relationships
            WHERE tenant_id = $1 AND user_id = $2) AS relationship_count`,
        [tenant(authority), request.userId],
      );
      const countRow = counts.rows[0]!;
      return {
        userId: row.user_id,
        state: row.state,
        revision: numberValue(row.revision),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        identityCount: numberValue(countRow.identity_count),
        relationshipCount: numberValue(countRow.relationship_count),
      };
    },

    async listAgentRuns(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "agents.runs.read",
      );
      const values: unknown[] = [tenant(authority), boundedLimit(request.limit)];
      const stateClause = request.state ? "AND state = $3" : "";
      if (request.state) values.push(request.state);
      const result = await input.database.query<{
        agent_run_id: string;
        user_id: string;
        character_id: string;
        character_session_id: string;
        state: PlatformAdminAgentRun["state"];
        failure_code: string | null;
        started_at: Date | string;
        updated_at: Date | string;
        completed_at: Date | string | null;
        correlation_id: string;
      }>(
        `SELECT agent_run_id, user_id, character_id, character_session_id,
                state, failure_code, started_at, updated_at, completed_at,
                correlation_id
           FROM agents.agent_runs
          WHERE tenant_id = $1
            ${stateClause}
          ORDER BY started_at DESC
          LIMIT $2`,
        values,
      );
      return result.rows.map((row) => ({
        agentRunId: row.agent_run_id,
        userId: row.user_id,
        characterId: row.character_id,
        characterSessionId: row.character_session_id,
        state: row.state,
        failureCode: row.failure_code,
        startedAt: iso(row.started_at),
        updatedAt: iso(row.updated_at),
        completedAt: row.completed_at === null ? null : iso(row.completed_at),
        correlationId: row.correlation_id,
      }));
    },

    async listOffers(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "commerce.read",
      );
      const result = await input.database.query<{
        offer_id: string;
        key: string;
        revision: string | number;
        enabled: boolean;
        updated_at: Date | string;
      }>(
        `SELECT o.offer_id, o.key, h.current_revision AS revision,
                h.enabled, h.updated_at
           FROM commerce.offers o
           JOIN commerce.offer_heads h
             ON h.tenant_id = o.tenant_id AND h.offer_id = o.offer_id
          WHERE o.tenant_id = $1
          ORDER BY h.updated_at DESC
          LIMIT $2`,
        [tenant(authority), boundedLimit(request.limit)],
      );
      return result.rows.map((row) => ({
        offerId: row.offer_id,
        key: row.key,
        revision: numberValue(row.revision),
        enabled: row.enabled,
        updatedAt: iso(row.updated_at),
      }));
    },

    async listFulfillments(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "commerce.read",
      );
      const result = await input.database.query<{
        fulfillment_id: string;
        quote_id: string;
        created_at: Date | string;
        completed_at: Date | string | null;
      }>(
        `SELECT f.fulfillment_id, f.quote_id, f.created_at, c.completed_at
           FROM commerce.fulfillments f
           LEFT JOIN commerce.fulfillment_completions c
             ON c.tenant_id = f.tenant_id
            AND c.fulfillment_id = f.fulfillment_id
          WHERE f.tenant_id = $1
          ORDER BY f.created_at DESC
          LIMIT $2`,
        [tenant(authority), boundedLimit(request.limit)],
      );
      return result.rows.map((row) => ({
        fulfillmentId: row.fulfillment_id,
        quoteId: row.quote_id,
        state: row.completed_at === null ? "admitted" : "succeeded",
        createdAt: iso(row.created_at),
        completedAt: row.completed_at === null ? null : iso(row.completed_at),
      }));
    },

    async listLedger(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "commerce.read",
      );
      const result = await input.database.query<{
        ledger_entry_id: string;
        debit_kind: string;
        debit_user_id: string | null;
        debit_character_id: string | null;
        credit_kind: string;
        credit_user_id: string | null;
        credit_character_id: string | null;
        amount_credits: string | number;
        reason: string;
        quote_id: string | null;
        fulfillment_id: string | null;
        created_at: Date | string;
      }>(
        `SELECT ledger_entry_id, debit_kind, debit_user_id, debit_character_id,
                credit_kind, credit_user_id, credit_character_id,
                amount_credits, reason, quote_id, fulfillment_id, created_at
           FROM commerce.ledger_entries
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [tenant(authority), boundedLimit(request.limit)],
      );
      return result.rows.map((row) => ({
        ledgerEntryId: row.ledger_entry_id,
        debitKind: row.debit_kind,
        debitUserId: row.debit_user_id,
        debitCharacterId: row.debit_character_id,
        creditKind: row.credit_kind,
        creditUserId: row.credit_user_id,
        creditCharacterId: row.credit_character_id,
        amountCredits: numberValue(row.amount_credits),
        reason: row.reason,
        quoteId: row.quote_id,
        fulfillmentId: row.fulfillment_id,
        createdAt: iso(row.created_at),
      }));
    },

    async listOperations(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "operations.read",
      );
      const values: unknown[] = [tenant(authority), boundedLimit(request.limit)];
      const stateClause = request.state ? "AND state = $3" : "";
      if (request.state) values.push(request.state);
      const result = await input.database.query<{
        operation_id: string;
        kind: string;
        state: string;
        attempt: number;
        provider: string | null;
        terminal_error_code: string | null;
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `SELECT operation_id, kind, state, attempt, provider,
                terminal_error_code, created_at, updated_at
           FROM events.operations
          WHERE tenant_id = $1
            ${stateClause}
          ORDER BY updated_at DESC
          LIMIT $2`,
        values,
      );
      return result.rows.map((row) => ({
        operationId: row.operation_id,
        kind: row.kind,
        state: row.state,
        attempt: row.attempt,
        provider: row.provider,
        terminalErrorCode: row.terminal_error_code,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }));
    },

    async listReconciliation(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "reconciliation.read",
      );
      const values: unknown[] = [tenant(authority), boundedLimit(request.limit)];
      const statusClause = request.status ? "AND status = $3" : "";
      if (request.status) values.push(request.status);
      const result = await input.database.query<{
        reconciliation_case_id: string;
        operation_id: string;
        status: string;
        reason_code: string;
        safe_retry: boolean;
        next_action: string | null;
        opened_at: Date | string;
        updated_at: Date | string;
        resolved_at: Date | string | null;
      }>(
        `SELECT reconciliation_case_id, operation_id, status, reason_code,
                safe_retry, next_action, opened_at, updated_at, resolved_at
           FROM events.reconciliation_cases
          WHERE tenant_id = $1
            ${statusClause}
          ORDER BY updated_at DESC
          LIMIT $2`,
        values,
      );
      return result.rows.map((row) => ({
        reconciliationCaseId: row.reconciliation_case_id,
        operationId: row.operation_id,
        status: row.status,
        reasonCode: row.reason_code,
        safeRetry: row.safe_retry,
        nextAction: row.next_action,
        openedAt: iso(row.opened_at),
        updatedAt: iso(row.updated_at),
        resolvedAt: row.resolved_at === null ? null : iso(row.resolved_at),
      }));
    },

    async listCredentialRefs(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "providers.credentials.read",
      );
      const result = await input.database.query<{
        credential_ref_id: string;
        provider_id: string;
        slot_key: string;
        generation: number;
        algorithm: string;
        key_id: string;
        active: boolean;
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `SELECT credential_ref_id, provider_id, slot_key, generation,
                algorithm, key_id, active, created_at, updated_at
           FROM security.credential_refs
          WHERE tenant_id = $1
          ORDER BY updated_at DESC
          LIMIT $2`,
        [tenant(authority), boundedLimit(request.limit)],
      );
      return result.rows.map((row) => ({
        credentialRefId: row.credential_ref_id,
        providerId: row.provider_id,
        slotKey: row.slot_key,
        generation: row.generation,
        algorithm: row.algorithm,
        keyId: row.key_id,
        active: row.active,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      }));
    },

    async listAuditEvents(request) {
      const authority = await authorize(
        request.authorizationHeader,
        "audit.read",
      );
      const result = await input.database.query<{
        audit_event_id: string;
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        occurred_at: Date | string;
        recorded_at: Date | string;
        correlation_id: string;
        sensitivity: string;
      }>(
        `SELECT audit_event_id, event_type, aggregate_type, aggregate_id,
                occurred_at, recorded_at, correlation_id, sensitivity
           FROM events.audit_events
          WHERE tenant_id = $1
          ORDER BY recorded_at DESC
          LIMIT $2`,
        [tenant(authority), boundedLimit(request.limit)],
      );
      return result.rows.map((row) => ({
        auditEventId: row.audit_event_id,
        eventType: row.event_type,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        occurredAt: iso(row.occurred_at),
        recordedAt: iso(row.recorded_at),
        correlationId: row.correlation_id,
        sensitivity: row.sensitivity,
      }));
    },
  });
}
