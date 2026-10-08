
import { createHash, randomUUID } from "node:crypto";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import { SupportError, type SupportOperationKind, type SupportOperationReader, type SupportTicket, type SupportTicketStore, type VerifiedSupportOperation } from "./model.js";
import type { BillingCheckoutService } from "../billing_checkout.js";

const referencePattern = /^[A-Za-z0-9_.-]{1,128}$/u;
const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function mask(value: string): string {
  // Never return an entire account/financial provider reference from support APIs.
  return "••••" + value.slice(-4);
}

export interface CustomerSupportService {
  status(input: Readonly<{ authorizationHeader: string | undefined; kind: SupportOperationKind; reference: string }>): Promise<Readonly<{ kind: SupportOperationKind; referenceMask: string; phase: string; observedAt: string; message: string }>>;
  create(input: Readonly<{ authorizationHeader: string | undefined; requestKey: string; kind: "general" | SupportOperationKind; reference?: string; summary: string; shareWithSupport: boolean }>): Promise<SupportTicket>;
  list(input: Readonly<{ authorizationHeader: string | undefined; limit: number }>): Promise<readonly SupportTicket[]>;
  read(input: Readonly<{ authorizationHeader: string | undefined; id: string }>): Promise<SupportTicket>;
}

function advice(phase: string): string {
  switch (phase) {
    case "succeeded": return "Provider success is recorded. Check your receipt; contact support if anything is missing.";
    case "refunded": return "A refund state is recorded. Its arrival in your account may require independent confirmation.";
    case "failed": return "The operation is recorded as failed. Do not retry a payment before checking its full history.";
    case "pending": return "Not yet confirmed. Do not repeat a payment or transfer while the outcome is uncertain.";
    default: return "Status is not verified. No new payment, refund or transfer was started.";
  }
}

export function createCustomerSupportService(input: Readonly<{
  authorizer: PlatformCustomerSessionAuthorizer;
  operations: SupportOperationReader;
  tickets: SupportTicketStore;
  now?: () => string;
}>): CustomerSupportService {
  const now = input.now ?? (() => new Date().toISOString());
  async function identity(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }
  async function ownedOperation(header: string | undefined, kind: SupportOperationKind, reference: string, owner: { tenantId: string; userId: string }): Promise<VerifiedSupportOperation> {
    if (!referencePattern.test(reference)) throw new SupportError("INVALID_REFERENCE", 400);
    let operation: VerifiedSupportOperation | null;
    try {
      operation = await input.operations.read({ tenantId: owner.tenantId, userId: owner.userId, authorizationHeader: header, kind, reference });
    } catch {
      throw new SupportError("SUPPORT_STATUS_UNAVAILABLE", 503);
    }
    if (!operation || operation.kind !== kind || operation.reference !== reference) {
      // No distinction among unowned, blocked, deleted and nonexistent IDs.
      throw new SupportError("OPERATION_UNAVAILABLE", 404);
    }
    return operation;
  }
  return Object.freeze<CustomerSupportService>({
    async status(request) {
      const owner = await identity(request.authorizationHeader);
      const op = await ownedOperation(request.authorizationHeader, request.kind, request.reference, owner);
      return Object.freeze({
        kind: op.kind, referenceMask: mask(op.reference), phase: op.phase,
        observedAt: op.observedAt, message: advice(op.phase),
      });
    },
    async create(request) {
      const owner = await identity(request.authorizationHeader);
      if (request.shareWithSupport !== true) throw new SupportError("SUPPORT_CONSENT_REQUIRED", 400);
      if (!keyPattern.test(request.requestKey)) throw new SupportError("INVALID_IDEMPOTENCY_KEY", 400);
      const summary = request.summary.trim();
      if (summary.length < 20 || summary.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(summary)) {
        throw new SupportError("INVALID_SUMMARY", 400);
      }
      if (request.kind !== "general" && request.kind !== "billing_quote" && request.kind !== "crypto_intent") {
        throw new SupportError("INVALID_KIND", 400);
      }
      if (request.kind === "general" && request.reference) throw new SupportError("INVALID_REFERENCE", 400);
      let op: VerifiedSupportOperation | null = null;
      if (request.kind !== "general") {
        op = await ownedOperation(request.authorizationHeader, request.kind, request.reference ?? "", owner);
      }
      const requestDigest = createHash("sha256").update(JSON.stringify({
        kind: request.kind, reference: op?.reference ?? null, summary,
      })).digest("hex");
      const ticket = await input.tickets.create({
        tenantId: owner.tenantId, userId: owner.userId, id: randomUUID(),
        requestKey: request.requestKey, requestDigest, kind: request.kind,
        reference: op?.reference ?? null,
        referenceMask: op ? mask(op.reference) : null,
        operationPhase: op?.phase ?? null, summary, createdAt: now(),
      });
      if (!ticket) throw new SupportError("SUPPORT_IDEMPOTENCY_CONFLICT", 409);
      return ticket;
    },
    async list(request) {
      const owner = await identity(request.authorizationHeader);
      if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) throw new SupportError("INVALID_LIMIT", 400);
      return input.tickets.list({ tenantId: owner.tenantId, userId: owner.userId, limit: request.limit });
    },
    async read(request) {
      const owner = await identity(request.authorizationHeader);
      if (!keyPattern.test(request.id)) throw new SupportError("SUPPORT_NOT_FOUND", 404);
      const ticket = await input.tickets.read({ tenantId: owner.tenantId, userId: owner.userId, id: request.id });
      if (!ticket) throw new SupportError("SUPPORT_NOT_FOUND", 404);
      return ticket;
    },
  });
}

// Read-only adapter: uses the existing authenticated Billing history query, NOT
// checkout.read(), which intentionally runs provider reconciliation and may change
// financial state. Unknown/older-than-history operations fail closed.
export function createBillingHistorySupportReader(billing: BillingCheckoutService, now: () => string = () => new Date().toISOString()): SupportOperationReader {
  return Object.freeze({
    async read(request) {
      if (request.kind !== "billing_quote") return null;
      const history = await billing.list({ authorizationHeader: request.authorizationHeader, limit: 100 });
      const result = history.find(item => item.quote.quoteId === request.reference);
      if (!result) return null;
      const phase = result.phase === "fulfilled" ? "succeeded"
        : result.phase === "failed" ? "failed"
        : result.phase === "refunded" ? "refunded"
        : "pending";
      return Object.freeze({ kind: "billing_quote", reference: result.quote.quoteId, phase, observedAt: now() });
    },
  });
}

// Composition for future R08 owner: financial lookup must prove tenant+user
// itself, and may NOT use raw provider IDs or accept guessed wallet recipients.
export function combineSupportOperationReaders(readers: readonly SupportOperationReader[]): SupportOperationReader {
  return Object.freeze({
    async read(request) {
      for (const reader of readers) {
        const result = await reader.read(request);
        if (result) return result;
      }
      return null;
    },
  });
}
