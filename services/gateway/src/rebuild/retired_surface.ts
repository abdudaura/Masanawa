/**
 * R0 rebuild retirement boundary.
 *
 * This denies ONLY legacy product namespaces. New Masana profiles, verified
 * social links and the distinct P2P escrow APIs are deliberately NOT denied.
 * Historical ledger/receipt reads outside these old namespaces remain intact.
 *
 * Register at Gateway onRequest so both REST and WebSocket *handshakes* for
 * retired paths fail before a legacy handler can execute. Internal WS messages
 * and direct job enqueue still require their own R0 guards.
 */
const RETIRED_PATHS: readonly RegExp[] = [
  /^\/(?:v1\/)?(?:talks?|twins?|clones?|creator|owner-access)(?:\/|$)/i,
  /^\/(?:v1\/)?(?:human(?:-|_)?dm|human(?:-|_)?calls?|contacts?)(?:\/|$)/i,
  /^\/agent\/twins?(?:\/|$)/i,
  /^\/v1\/(?:wallet\/transfers|twins?\/|gifts?\/|paid-voice\/)/i,
  /^\/v1\/admin\/(?:twins?|clones?|owner-access|commission-polic(?:y|ies)|linked-whatsapp|whatsapp)(?:\/|$)/i,
  /^\/(?:v1\/)?(?:customer\/channels|customer-channels|whatsapp|telegram)(?:\/|$)/i,
  /^\/v1\/(?:channels|channel-bridge|linked-whatsapp)(?:\/|$)/i,
  // Actual registered legacy endpoints not covered by the broad /talks and /twins rules.
  /^\/v1\/my-twin(?:\/|$)/i,
  /^\/me\/talks(?:\/|$)/i,
  /^\/(?:v1\/)?channels\/(?:whatsapp|telegram)(?:\/|$)/i,
  /^\/admin\/channels\/(?:whatsapp|telegram)(?:\/|$)/i,
];

export function isRetiredLegacySurface(url: string): boolean {
  // Query parameters never change authority. URL.pathname retains the path
  // boundary, preventing a forged query from bypassing retirement.
  let pathname: string;
  try {
    pathname = new URL(url, "https://masanawa.invalid").pathname;
  } catch {
    // Reject a malformed URL at the ordinary gateway parser, not by claiming
    // that it matched a retired product feature.
    return false;
  }
  return RETIRED_PATHS.some(pattern => pattern.test(pathname));
}
