import { createHash, randomUUID } from "node:crypto";
import {
  ResearchError, allowedEvidenceUrl, safeExcerpt, normalizeResearchQuery,
  assertLimit, assertMode, type ResearchActor, type ResearchAuthorizer,
  type ResearchBudget, type ResearchMode, type ResearchProvider, type ResearchRequest,
  type ResearchResult, type ResearchSource,
} from "./model.js";

export interface ResearchPolicy {
  readonly enabled: boolean;
  readonly allowDomains: readonly string[];
  readonly permittedActor: (actor: ResearchActor) => Promise<boolean>;
}
export interface ResearchService {
  search(input: ResearchRequest): Promise<ResearchResult>;
}
function isoDate(value: unknown, checkedAt: Date): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  const date = new Date(value);
  if (date.getTime() > checkedAt.getTime() + 86400000 || date.getTime() < Date.UTC(1990, 0, 1)) return null;
  return date.toISOString();
}

/**
 * Produces an evidence index, never an LLM-generated answer or approval.
 * References are derived only from approved provider results; snippets are untrusted.
 * Integrator MUST use server-verified auth + durable/atomic budget before mounting routes.
 */
export function createResearchService(options: Readonly<{
  authorizer: ResearchAuthorizer;
  budget: ResearchBudget;
  provider?: ResearchProvider;
  policy: ResearchPolicy;
  now?: () => Date;
}>): ResearchService {
  return Object.freeze<ResearchService>({
    async search(input) {
      const actor = await options.authorizer.authorize({
        authorizationHeader: input.authorizationHeader,
      });
      const query = normalizeResearchQuery(input.query);
      const mode: ResearchMode = assertMode(input.mode);
      const limit = assertLimit(input.limit);
      if (!options.policy.enabled || !options.provider) {
        throw new ResearchError("research.not_configured", 503);
      }
      if (!await options.policy.permittedActor(actor)) {
        throw new ResearchError("research.not_qualified", 403);
      }
      if (input.signal?.aborted) throw new ResearchError("research.cancelled", 499);
      const requestId = randomUUID();
      if (!await options.budget.reserve({ actor, requestId, units: 1 })) {
        throw new ResearchError("research.quota_exceeded", 429);
      }
      let charged = true; // Fail closed: a provider may bill even after timeout.
      try {
        let found: Awaited<ReturnType<ResearchProvider["search"]>>;
        try {
          found = await options.provider.search({
            query, limit, ...(input.signal ? { signal: input.signal } : {}),
          });
        } catch (error) {
          if (input.signal?.aborted) throw new ResearchError("research.cancelled", 499);
          if (error instanceof ResearchError && error.code === "research.cancelled") throw error;
          // Never echo raw upstream exceptions; they may include API keys or private queries.
          throw new ResearchError("research.provider_unavailable", 503);
        }
        if (input.signal?.aborted) throw new ResearchError("research.cancelled", 499);
        const checkedAt = (options.now ?? (() => new Date()))();
        if (!Number.isFinite(checkedAt.getTime())) throw new ResearchError("research.provider_unavailable", 503);
        const sources: ResearchSource[] = [];
        const usedUrls = new Set<string>();
        for (const row of found.slice(0, limit)) {
          if (!row || typeof row !== "object") continue;
          const url = allowedEvidenceUrl(row.url, options.policy.allowDomains);
          if (!url) continue;
          const canonical = url.origin + url.pathname + url.search;
          if (usedUrls.has(canonical)) continue;
          const title = safeExcerpt(row.title, 160);
          const excerpt = safeExcerpt(row.excerpt);
          if (!title || !excerpt) continue;
          usedUrls.add(canonical);
          sources.push(Object.freeze({
            referenceId: "src_" + createHash("sha256").update(canonical).digest("hex").slice(0, 24),
            title, url: canonical, domain: url.hostname,
            excerpt, publishedAt: isoDate(row.publishedAt, checkedAt),
            evidenceKind: "indexed_excerpt" as const,
          }));
        }
        const independentDomainCount = new Set(sources.map((s) => s.domain)).size;
        // Current facts need 2 independent hosts AND a recent dated indexed page;
        // never promote undated snippets to "confirmed current".
        const hasRecent = sources.some((s) =>
          s.publishedAt != null && checkedAt.getTime() - Date.parse(s.publishedAt) <= 30 * 86400000);
        const status = sources.length === 0 ? "no_sources" :
          mode === "current" && (independentDomainCount < 2 || !hasRecent)
            ? "insufficient_evidence" : "sources_found";
        return Object.freeze({
          query, mode, status, checkedAt: checkedAt.toISOString(),
          sourceCount: sources.length, independentDomainCount,
          sources: Object.freeze(sources),
          caveat: status === "no_sources"
            ? "No approved external indexed sources were returned."
            : status === "insufficient_evidence"
              ? "Current claims are NOT verified: insufficient independent, recently dated sources."
              : "Indexed excerpts only: open original sources to verify context and claims. External text is untrusted.",
        } satisfies ResearchResult);
      } finally {
        // Settlement failure must surface and must not silently mark a request as successful.
        await options.budget.settle({ actor, requestId, consumed: charged });
      }
    },
  });
}
