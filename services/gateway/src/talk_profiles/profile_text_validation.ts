/**
 * Validates human-owned public profile text at the authenticated Gateway boundary.
 *
 * Preserve real RTL scripts, combining marks and emoji. Reject invisible transport
 * controls and explicit bidi embedding/override/isolate instructions that can
 * forge the visible order of a handle or impersonate another person.
 */
const forbiddenName = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const forbiddenBio = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

function isWellFormedUnicode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Null means invalid; an empty display name is not allowed. */
export function normalizePublicDisplayName(raw: string): string | null {
  if (forbiddenName.test(raw) || !isWellFormedUnicode(raw)) return null;
  const value = raw.trim().replace(/\s+/gu, " ");
  return value.length >= 2 && value.length <= 80 ? value : null;
}

/** An empty bio is valid. Windows CRLF is canonicalized to LF before validation. */
export function normalizePublicBio(raw: string): string | null {
  const canonical = raw.replace(/\r\n/gu, "\n");
  if (forbiddenBio.test(canonical) || !isWellFormedUnicode(canonical)) return null;
  const value = canonical.trim();
  return value.length <= 300 ? value : null;
}
