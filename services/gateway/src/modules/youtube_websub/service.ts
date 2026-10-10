import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const YOUTUBE_OUTBOX_DESTINATION = "external-videos.youtube.reconcile";
const channelPattern = /^UC[a-zA-Z0-9_-]{22}$/u;
const signaturePattern = /^sha1=([0-9a-f]{40})$/iu;

/** The opaque callback token is selected at provisioning; it is never a user ID. */
export interface YouTubeSubscription {
  readonly tenantId: string;
  readonly sourceId: string;
  readonly channelId: string;
  readonly signatureSecret: string;
  readonly enabled: boolean;
  readonly authorized: boolean;
}
export interface YouTubeWebSubStore {
  findByCallbackToken(token: string): Promise<YouTubeSubscription | null>;
  /**
   * Must atomically insert a single durable events.outbox record for this
   * tenant+operation key. Return false on already-seen events.
   * Do not enqueue a second job when a webhook is replayed.
   */
  confirmVerifiedLease(input: {
    callbackToken: string; tenantId: string; sourceId: string; leaseSeconds: number;
  }): Promise<boolean>;
  enqueueReconciliation(input: {
    tenantId: string; sourceId: string; channelId: string;
    operationKey: string; eventBodySha256: string;
    destination: typeof YOUTUBE_OUTBOX_DESTINATION;
  }): Promise<boolean>;
}
export class YouTubeWebhookError extends Error {
  constructor(readonly status: number, readonly reason: string) {
    super(reason);
  }
}
export function youtubeTopic(channelId: string): string {
  if (!channelPattern.test(channelId)) throw new YouTubeWebhookError(422, "invalid_channel");
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
}
function validToken(token: string): boolean {
  return /^[a-zA-Z0-9_-]{32,128}$/u.test(token);
}
function assertAllowed(subscription: YouTubeSubscription | null): asserts subscription is YouTubeSubscription {
  if (!subscription || !subscription.enabled || !subscription.authorized ||
    !subscription.tenantId || !subscription.sourceId ||
    !channelPattern.test(subscription.channelId) || subscription.signatureSecret.length < 32) {
    throw new YouTubeWebhookError(404, "subscription_unavailable");
  }
}
function queryValue(q: Record<string, unknown>, key: string): string | null {
  const value = q[key];
  return typeof value === "string" ? value : null;
}
function signedBody(secret: string, body: Buffer, header: string | undefined): boolean {
  const match = header && signaturePattern.exec(header);
  if (!match) return false;
  const provided = Buffer.from(match[1]!, "hex");
  const expected = createHmac("sha1", secret).update(body).digest();
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function createYouTubeWebSubService(store: YouTubeWebSubStore) {
  async function getSubscription(token: string): Promise<YouTubeSubscription> {
    if (!validToken(token)) throw new YouTubeWebhookError(404, "subscription_unavailable");
    const subscription = await store.findByCallbackToken(token);
    assertAllowed(subscription);
    return subscription;
  }
  return {
    /** The hub GET challenge must echo the original challenge unchanged. */
    async verifyChallenge(token: string, query: Record<string, unknown>): Promise<string> {
      const sub = await getSubscription(token);
      const mode = queryValue(query, "hub.mode");
      const topic = queryValue(query, "hub.topic");
      const challenge = queryValue(query, "hub.challenge");
      const lease = queryValue(query, "hub.lease_seconds");
      if (mode !== "subscribe" || topic !== youtubeTopic(sub.channelId) ||
        !challenge || challenge.length > 2048 || (lease !== null && !/^[1-9]\d{0,8}$/u.test(lease))) {
        throw new YouTubeWebhookError(400, "invalid_challenge");
      }
      const confirmed = await store.confirmVerifiedLease({
        callbackToken:token, tenantId:sub.tenantId, sourceId:sub.sourceId,
        leaseSeconds:Math.min(lease === null ? 432000 : Number(lease),604800),
      });
      if (!confirmed) throw new YouTubeWebhookError(409,"subscription_not_pending");
      return challenge;
    },
    /** Reject unauthenticated Atom before any enqueue. Atom is not trusted as a source of truth. */
    async notify(token: string, body: Buffer, signature: string | undefined): Promise<{ accepted: true; duplicate: boolean }> {
      const sub = await getSubscription(token);
      if (!Buffer.isBuffer(body) || body.length < 20 || body.length > 65536) {
        throw new YouTubeWebhookError(413, "invalid_body");
      }
      if (!signedBody(sub.signatureSecret, body, signature)) {
        throw new YouTubeWebhookError(401, "bad_signature");
      }
      const hash = createHash("sha256").update(body).digest("hex");
      const operationKey = `youtube-websub:${sub.sourceId}:${hash}`;
      const created = await store.enqueueReconciliation({
        tenantId: sub.tenantId, sourceId: sub.sourceId, channelId: sub.channelId,
        operationKey, eventBodySha256: hash, destination: YOUTUBE_OUTBOX_DESTINATION,
      });
      return {accepted: true, duplicate: !created};
    },
  };
}
