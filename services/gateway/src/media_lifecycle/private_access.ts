/** Private media URL delivery guard (AF15). No client-provided owner or object key. */
export interface MediaPrincipal { userId: string; tenantId: string }
export interface AuthorizedMedia {
  allowed: true;
  tenantId: string;
  mediaId: string;
  objectKey: string;
  /** Changed by any visibility, membership, block, hold or deletion mutation. */
  accessRevision: string;
}
export type MediaDecision = AuthorizedMedia | { allowed: false };
export interface PrivateMediaAuthority {
  /** Return only the current authenticated server session, never request identity. */
  principal(): Promise<MediaPrincipal | null>;
  /** Must check tenant, membership, blocking, content status and holds now. */
  authorize(principal: MediaPrincipal, mediaId: string): Promise<MediaDecision>;
  /** Server-side object signer; expiry is bounded independently by this guard. */
  sign(objectKey: string, ttlSeconds: number): Promise<string>;
}
export interface PrivateMediaAccessOptions {
  mediaId: string;
  /** Server configuration, not a client value. */
  objectPrefix: string;
  signerHost: string;
  ttlSeconds?: number;
  clockMs?: () => number;
}
export interface PrivateMediaTicket {
  url: string;
  expiresAtMs: number;
  cacheControl: 'private, no-store';
}
export type MediaAccessErrorCode = 'unauthenticated' | 'not_found' | 'temporarily_unavailable' | 'invalid_request';
export class MediaAccessError extends Error {
  readonly code: MediaAccessErrorCode;
  constructor(code: MediaAccessErrorCode) { super(code); this.code = code; this.name = 'MediaAccessError'; }
}
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;
function safeKey(key: unknown, prefix: string): key is string {
  return typeof key === 'string' && key.startsWith(prefix) &&
    KEY.test(key) && key.split('/').every(s => s !== '' && s !== '.' && s !== '..');
}
function matching(a: AuthorizedMedia, b: MediaDecision, mediaId: string, tenantId: string): boolean {
  return b.allowed === true && a.mediaId === mediaId && b.mediaId === mediaId &&
    a.tenantId === tenantId && b.tenantId === tenantId &&
    a.objectKey === b.objectKey && a.accessRevision === b.accessRevision;
}
/**
 * Signs only after checking current permission; rechecks AFTER signing to reject
 * revoked/changed memberships. Previously issued links still live until their
 * short expiry: storage policy must enforce private access and avoid URL caching.
 */
export async function issuePrivateMediaUrl(
  options: PrivateMediaAccessOptions,
  authority: PrivateMediaAuthority,
): Promise<PrivateMediaTicket> {
  const { mediaId, objectPrefix, signerHost } = options;
  const ttl = options.ttlSeconds ?? 30;
  if (!ID.test(mediaId) || typeof objectPrefix !== 'string' ||
      !/^private\/[A-Za-z0-9][A-Za-z0-9_/-]*\/$/.test(objectPrefix) ||
      objectPrefix.includes('//') || objectPrefix.length > 160 ||
      !Number.isSafeInteger(ttl) || ttl < 5 || ttl > 60 ||
      !/^[a-z0-9.-]+$/.test(signerHost) || signerHost.startsWith('.') ||
      signerHost.endsWith('.')) {
    throw new MediaAccessError('invalid_request');
  }
  const now = options.clockMs?.() ?? Date.now();
  if (!Number.isSafeInteger(now) || now <= 0) throw new MediaAccessError('invalid_request');
  let principal: MediaPrincipal | null;
  try { principal = await authority.principal(); }
  catch { throw new MediaAccessError('temporarily_unavailable'); }
  if (!principal) throw new MediaAccessError('unauthenticated');
  if (!ID.test(principal.userId) || !ID.test(principal.tenantId)) {
    throw new MediaAccessError('unauthenticated');
  }
  // Copy session scalars before any async callback can mutate a cached object.
  const session: MediaPrincipal = { userId: principal.userId, tenantId: principal.tenantId };
  let first: MediaDecision;
  try { first = await authority.authorize(session, mediaId); }
  catch { throw new MediaAccessError('temporarily_unavailable'); }
  if (!first || first.allowed !== true || !matching(first, first, mediaId, session.tenantId) ||
      !safeKey(first.objectKey, objectPrefix) ||
      typeof first.accessRevision !== 'string' || first.accessRevision.length < 1) {
    throw new MediaAccessError('not_found');
  }
  // An authority may return a mutable cached object. Freeze the decision scalars
  // by copying, rather than relying on its reference after an awaited signer.
  const granted: AuthorizedMedia = {
    allowed: true, tenantId: first.tenantId, mediaId: first.mediaId,
    objectKey: first.objectKey, accessRevision: first.accessRevision,
  };
  let signed: string;
  try { signed = await authority.sign(granted.objectKey, ttl); }
  catch { throw new MediaAccessError('temporarily_unavailable'); }
  try {
    const parsed = new URL(signed);
    if (parsed.protocol !== 'https:' || parsed.hostname !== signerHost ||
        parsed.username || parsed.password || parsed.hash) {
      throw new Error('Invalid signed URL');
    }
  } catch { throw new MediaAccessError('temporarily_unavailable'); }
  // Prevent returning a link for the old account after logout/account switch.
  let active: MediaPrincipal | null;
  try { active = await authority.principal(); }
  catch { throw new MediaAccessError('temporarily_unavailable'); }
  if (!active || active.userId !== session.userId || active.tenantId !== session.tenantId) {
    throw new MediaAccessError('unauthenticated');
  }
  let latest: MediaDecision;
  try { latest = await authority.authorize(session, mediaId); }
  catch { throw new MediaAccessError('temporarily_unavailable'); }
  if (!latest || !matching(granted, latest, mediaId, session.tenantId)) {
    throw new MediaAccessError('not_found');
  }
  return { url: signed, expiresAtMs: now + ttl * 1000, cacheControl: 'private, no-store' };
}
