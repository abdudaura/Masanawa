import { visibleVideo, type ExternalVideo } from "@masanawa/external-videos";

/** Read-only approved projection; called only after tenancy and authentication
 * are established by the gateway composition owner. Pagination stays database-side. */
export interface VideoCatalogStore {
  list(input: { tenantId: string; provider?: "youtube" | "tiktok" | "facebook"; after?: string; limit: number }): Promise<{
    items: readonly (ExternalVideo & { id: string; title: string; sourceId: string })[];
    nextCursor: string | null;
  }>;
}
export function createVideoCatalog(store: VideoCatalogStore) {
  return {
    async list(input: { tenantId: string; provider?: "youtube" | "tiktok" | "facebook"; cursor?: string; limit?: number }) {
      if (!input.tenantId.trim()) throw new Error("missing tenant context");
      const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
      const result = await store.list({ tenantId: input.tenantId, ...(input.provider ? {provider:input.provider} : {}),
        ...(input.cursor ? {after:input.cursor} : {}), limit });
      return { items: result.items.filter(visibleVideo).map(item => ({
        id: item.id, title: item.title, provider: item.provider,
        channelName: item.channelName, canonicalUrl: item.canonicalUrl, embedUrl: item.embedUrl,
      })), nextCursor: result.nextCursor };
    }
  };
}
