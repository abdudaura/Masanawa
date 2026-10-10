/**
 * R0: fail-closed denylist for pre-rebuild routes. Historical ledger/receipt reads
 * are deliberately excluded; no migration or financial balance is modified here.
 *
 * Do not use this policy to authorize the new Masana endpoints: those require
 * their own tenant, identity, role and entitlement checks.
 */
const alwaysRetired = [
  /^\/(?:v1\/)?talks(?:\/|$)/,
  /^\/v1\/(?:twins?|clones?|creators?|owner-access|contacts|human-chats?|human-calls?|dms?)(?:\/|$)/,
  /^\/v1\/(?:admin\/)?(?:twin|clone|creator)(?:[\/-]|$)/,
  /^\/v1\/admin\/twin(?:[\/-]|$)/,
  /^\/admin\/channels\/whatsapp(?:\/|$)/,
  // Legacy user/creator entry points use both root and /v1 namespaces.
  // The replacement per-Masana Social Accounts API is under /v1/admin/masana.
  /^\/(?:agent\/twins|creator)(?:\/|$)/,
  /^\/(?:whatsapp|telegram|customer\/channels)(?:\/|$)/,
  /^\/v1\/(?:channels|admin\/linked-whatsapp|admin\/commission-polic(?:y|ies))(?:\/|$)/,
  /^\/v1\/(?:customer-channels|linked-whatsapp|channel-bridge)(?:\/|$)/,
];

const retiredWrites = [
  /^\/v1\/(?:audio-posts|member-posts|user-posts)(?:\/|$)/,
  /^\/v1\/(?:posts|rooms)(?:\/|$)/,
  /^\/v1\/wallet\/(?:transfers|gifts)(?:\/|$)/,
];

/**
 * Returns true only for known legacy entry points, never for canonical
 * fan↔Masana chats, existing Bills/Crypto or historical finance readbacks.
 * Decoding once prevents bypass through encoded path separators; malformed
 * encoding is not a reason to enable any legacy route.
 */
export function isRetiredLegacyRequest(method: string, rawUrl: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(rawUrl.split("?")[0] ?? "").replace(/\/{2,}/g, "/");
  } catch {
    return /(?:talk|twin|clone|creator|contact|channel|gift|owner-access)/i.test(rawUrl);
  }
  if (alwaysRetired.some((pattern) => pattern.test(path))) return true;
  const verb = method.toUpperCase();
  return verb !== "GET" && verb !== "HEAD" &&
    retiredWrites.some((pattern) => pattern.test(path));
}
