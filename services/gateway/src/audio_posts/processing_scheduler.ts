/** AF09 Published Talks: bounded pending-tenant discovery and job dispatch.
 * AF00 injects this into the single trusted worker runtime after migrations.
 * This is NOT a second post queue and never accepts a client tenant list.
 */
import type { Pool } from "@masanawa/postgres";
import type { ProcessingSweep } from './processing_worker.js';

const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);

export interface PendingTenantPage {
  tenantIds: string[];
  nextCursor: string | null;
}
export interface PendingTenantScanner {
  listPendingTenants(input: {
    afterTenantId: string | null; limit: number;
  }): Promise<PendingTenantPage>;
}

/** Reads actual pending social.audio_posts; does not store, guess or accept
 * tenants from devices. A C-collated keyset stays stable across locales.
 * Cursor pagination permits bounded work across many tenants; the caller
 * keeps the returned cursor and wraps to null after the last page.
 */
export function createPostgresPendingTenantScanner(pool: Pick<Pool, 'query'>): PendingTenantScanner {
  return {
    async listPendingTenants({ afterTenantId, limit }) {
      if ((afterTenantId !== null && !validId(afterTenantId)) ||
          !Number.isSafeInteger(limit) || limit < 1 || limit > 30) {
        throw new Error('audio_posts.invalid_tenant_scan');
      }
      const result = await pool.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM (
           SELECT DISTINCT tenant_id COLLATE "C" AS tenant_id
           FROM social.audio_posts
           WHERE status='processing' AND
             ($1::text IS NULL OR tenant_id COLLATE "C" > ($1::text COLLATE "C"))
         ) AS pending
         ORDER BY tenant_id ASC LIMIT $2`,
        [afterTenantId, limit + 1],
      );
      if (!Array.isArray(result.rows) || result.rows.length > limit + 1) {
        throw new Error('audio_posts.invalid_tenant_rows');
      }
      const ids = result.rows.map(row => row?.tenant_id);
      if (ids.some(id => !validId(id)) || ids.some((id, index) =>
          (index > 0 && id! <= ids[index - 1]!) ||
          (afterTenantId !== null && id! <= afterTenantId))) {
        throw new Error('audio_posts.invalid_tenant_rows');
      }
      const tenantIds = ids.slice(0, limit) as string[];
      return {
        tenantIds,
        nextCursor: ids.length > limit ? tenantIds[tenantIds.length - 1]! : null,
      };
    },
  };
}

export type AudioPostWorker = {
  runOnce(input: { tenantId: string; cursor?: string | null }): Promise<ProcessingSweep>;
};
export interface TenantDispatchResult {
  tenantCursor: string | null;
  processedTenants: number;
  failedTenants: number;
  scannedPosts: number;
  published: number;
  rejected: number;
  changed: number;
  leasedElsewhere: number;
  retryableErrors: number;
}

/** A finite pass across tenants and their existing revision-CAS worker pages.
 * It intentionally does not spin forever on pending failures or claim success
 * when a tenant scan/worker fails. AF00 owns persisted schedule cursor, startup,
 * shutdown, cancellation, observability and actual moderation credentials.
 */
export function createAudioPostTenantDispatcher(deps: {
  scanner: PendingTenantScanner;
  worker: AudioPostWorker;
  maxTenants?: number;
  maxPagesPerTenant?: number;
  onTenantError: (failure: { tenantId: string; error: unknown }) => void;
}) {
  const maxTenants = deps.maxTenants ?? 10;
  const maxPagesPerTenant = deps.maxPagesPerTenant ?? 2;
  if (![maxTenants, maxPagesPerTenant].every(value =>
      Number.isSafeInteger(value) && value >= 1 && value <= 30)) {
    throw new Error('audio_posts.invalid_dispatch_limit');
  }
  return {
    async runOnce(afterTenantId: string | null = null): Promise<TenantDispatchResult> {
      if (afterTenantId !== null && !validId(afterTenantId)) {
        throw new Error('audio_posts.invalid_tenant_cursor');
      }
      const page = await deps.scanner.listPendingTenants({
        afterTenantId, limit: maxTenants,
      });
      if (!page || !Array.isArray(page.tenantIds) ||
          page.tenantIds.length > maxTenants ||
          (page.nextCursor !== null && !validId(page.nextCursor))) {
        throw new Error('audio_posts.invalid_tenant_page');
      }
      const seen = new Set<string>();
      for (const tenantId of page.tenantIds) {
        if (!validId(tenantId) || (afterTenantId !== null && tenantId <= afterTenantId) ||
            seen.has(tenantId)) throw new Error('audio_posts.invalid_tenant_page');
        seen.add(tenantId);
      }
      if (page.nextCursor !== null && page.nextCursor !== page.tenantIds.at(-1)) {
        throw new Error('audio_posts.invalid_tenant_page');
      }
      const result: TenantDispatchResult = {
        tenantCursor: page.nextCursor, processedTenants: 0, failedTenants: 0,
        scannedPosts: 0, published: 0, rejected: 0, changed: 0,
        leasedElsewhere: 0, retryableErrors: 0,
      };
      for (const tenantId of page.tenantIds) {
        try {
          let cursor: string | null = null;
          const cursors = new Set<string>();
          for (let pageIndex = 0; pageIndex < maxPagesPerTenant; pageIndex++) {
            const batch = await deps.worker.runOnce({ tenantId, cursor });
            if (!batch || !Number.isSafeInteger(batch.scanned) || batch.scanned < 0 ||
                !Number.isSafeInteger(batch.published) || batch.published < 0 ||
                !Number.isSafeInteger(batch.rejected) || batch.rejected < 0 ||
                !Number.isSafeInteger(batch.changed) || batch.changed < 0 ||
                !Number.isSafeInteger(batch.leasedElsewhere) || batch.leasedElsewhere < 0 ||
                !Number.isSafeInteger(batch.retryableErrors) || batch.retryableErrors < 0 ||
                (batch.nextCursor !== null &&
                 (typeof batch.nextCursor !== 'string' ||
                  batch.nextCursor.length < 1 || batch.nextCursor.length > 256 ||
                  cursors.has(batch.nextCursor)))) {
              throw new Error('audio_posts.invalid_processing_sweep');
            }
            result.scannedPosts += batch.scanned;
            result.published += batch.published;
            result.rejected += batch.rejected;
            result.changed += batch.changed;
            result.leasedElsewhere += batch.leasedElsewhere;
            result.retryableErrors += batch.retryableErrors;
            if (batch.nextCursor === null) break;
            cursors.add(batch.nextCursor);
            cursor = batch.nextCursor;
          }
          result.processedTenants++;
        } catch (error) {
          result.failedTenants++;
          try { deps.onTenantError({ tenantId, error }); }
          catch { /* Logging failure cannot mask a durable pending post. */ }
        }
      }
      return result;
    },
  };
}
