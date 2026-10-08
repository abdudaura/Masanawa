import { ResearchError, safeExcerpt, type ResearchProvider } from "./model.js";

interface GoogleItem {
  title?: unknown;
  link?: unknown;
  snippet?: unknown;
  pagemap?: { metatags?: Array<Record<string, unknown>> };
}
export function googleResearchProvider(input: Readonly<{
  apiKey: string | undefined;
  engineId: string | undefined;
  fetcher?: typeof fetch;
  deadlineMs?: number;
}>): ResearchProvider {
  const apiKey = input.apiKey?.trim();
  const engineId = input.engineId?.trim();
  if (!apiKey || !engineId) {
    throw new ResearchError("research.not_configured", 503);
  }
  const fetcher = input.fetcher ?? fetch;
  const timeout = input.deadlineMs ?? 6500;
  if (!Number.isSafeInteger(timeout) || timeout < 500 || timeout > 15000) {
    throw new ResearchError("research.not_configured", 503);
  }
  return Object.freeze<ResearchProvider>({
    async search(request) {
      if (request.signal?.aborted) throw new ResearchError("research.cancelled", 499);
      const abort = new AbortController();
      const onAbort = () => abort.abort();
      request.signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => abort.abort(), timeout);
      try {
        // Fixed provider origin, never accept a URL selected by an agent or a source page.
        const url = new URL("https://www.googleapis.com/customsearch/v1");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("cx", engineId);
        url.searchParams.set("q", request.query);
        url.searchParams.set("num", String(request.limit));
        url.searchParams.set("safe", "active");
        const response = await fetcher(url, {
          method: "GET",
          redirect: "error",
          signal: abort.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          // Never include provider response/URL: it may contain API key or user query.
          throw new ResearchError("research.provider_unavailable", 503);
        }
        // Bound provider body, including when Content-Length is untrusted or missing.
        const reader = response.body?.getReader();
        if (!reader) throw new ResearchError("research.provider_unavailable", 503);
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 262144) {
            await reader.cancel();
            throw new ResearchError("research.provider_unavailable", 503);
          }
          chunks.push(part.value);
        }
        const body = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
        const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new ResearchError("research.provider_unavailable", 503);
        }
        const rows = (parsed as { items?: unknown }).items;
        if (rows !== undefined && !Array.isArray(rows)) {
          throw new ResearchError("research.provider_unavailable", 503);
        }
        return Object.freeze(((rows ?? []) as GoogleItem[]).slice(0, request.limit).map((row) => {
          const meta = row && typeof row === "object" && Array.isArray(row.pagemap?.metatags)
            ? row.pagemap.metatags[0] : undefined;
          const date = meta?.["article:published_time"] ?? meta?.["datePublished"];
          const publishedAt = typeof date === "string" && Number.isFinite(Date.parse(date))
            ? new Date(date).toISOString() : null;
          return Object.freeze({
            title: safeExcerpt(row?.title, 160),
            url: typeof row?.link === "string" ? row.link : "",
            excerpt: safeExcerpt(row?.snippet),
            publishedAt,
          });
        }));
      } catch (error) {
        if (request.signal?.aborted) throw new ResearchError("research.cancelled", 499);
        if (error instanceof ResearchError) throw error;
        // Network timeout, JSON errors and provider errors are indistinguishable to clients.
        throw new ResearchError("research.provider_unavailable", 503);
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", onAbort);
      }
    },
  });
}

