/** U28 read-only, evidence-only adapter. This is not a model/tool execution grant. */
export type ResearchMode = "general" | "current";
export type ResearchStatus = "sources_found" | "insufficient_evidence" | "no_sources";
export type ResearchErrorCode =
  | "research.invalid_request" | "research.not_configured" | "research.not_qualified"
  | "research.quota_exceeded" | "research.provider_unavailable"
  | "research.cancelled" | "research.unauthorized";

export class ResearchError extends Error {
  constructor(readonly code: ResearchErrorCode, readonly statusCode: number) {
    super(code);
    this.name = "ResearchError";
  }
}
export interface ResearchActor {
  readonly tenantId: string;
  readonly userId: string;
}
export interface ResearchRequest {
  readonly authorizationHeader: string | undefined;
  readonly query: string;
  readonly mode: ResearchMode;
  readonly limit?: number;
  readonly signal?: AbortSignal;
}
export interface ResearchSource {
  /** Opaque identity stable for this provider-result URL, never a client authority. */
  readonly referenceId: string;
  readonly title: string;
  readonly url: string;
  readonly domain: string;
  readonly excerpt: string;
  /** Null means the provider has not established a publication date. */
  readonly publishedAt: string | null;
  /** Only a search index excerpt; we have NOT visited the cited webpage. */
  readonly evidenceKind: "indexed_excerpt";
}
export interface ResearchResult {
  readonly query: string;
  readonly mode: ResearchMode;
  readonly status: ResearchStatus;
  readonly checkedAt: string;
  readonly sourceCount: number;
  readonly independentDomainCount: number;
  readonly sources: readonly ResearchSource[];
  readonly caveat: string;
}
export interface ResearchProvider {
  search(input: Readonly<{ query: string; limit: number; signal?: AbortSignal }>): Promise<readonly {
    title: string; url: string; excerpt: string; publishedAt: string | null;
  }[]>;
}
export interface ResearchAuthorizer {
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<ResearchActor>;
}
/** Must be PostgreSQL/Redis backed and atomic across worker instances (NOT an in-memory Map). */
export interface ResearchBudget {
  reserve(input: Readonly<{ actor: ResearchActor; requestId: string; units: number }>): Promise<boolean>;
  settle(input: Readonly<{ actor: ResearchActor; requestId: string; consumed: boolean }>): Promise<void>;
}
export function normalizeResearchQuery(value: unknown): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new ResearchError("research.invalid_request", 400);
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < 3 || normalized.length > 180) {
    throw new ResearchError("research.invalid_request", 400);
  }
  return normalized;
}
export function assertMode(value: unknown): ResearchMode {
  if (value !== "general" && value !== "current") {
    throw new ResearchError("research.invalid_request", 400);
  }
  return value;
}
export function assertLimit(value: unknown): number {
  if (value === undefined) return 5;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 8) {
    throw new ResearchError("research.invalid_request", 400);
  }
  return value;
}
export function safeExcerpt(value: unknown, max = 420): string {
  if (typeof value !== "string") return "";
  // Search-index text is untrusted DATA: do not interpolate in a tool/system prompt as commands.
  return value.replace(/<[^>]*>/gu, " ").replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ").trim().slice(0, max);
}
export function allowedEvidenceUrl(value: unknown, domains: readonly string[]): URL | null {
  if (typeof value !== "string" || value.length > 2048 || domains.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !url.hostname || url.hostname.endsWith(".") || url.hash.length > 0) return null;
    const host = url.hostname.toLowerCase();
    // No IP literals, localhost, internal naming, redirect endpoints or provider authority.
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
        host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/u.test(host)) return null;
    if (!domains.some((allowed) => {
      const domain = allowed.toLowerCase();
      return !!domain && /^[a-z0-9.-]+$/u.test(domain) &&
        (host === domain || host.endsWith("." + domain));
    })) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
