import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Masanawa invitation",
  robots: { index: false, follow: false, nocache: true },
};

const TOKEN_PATTERN = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const HANDLE_PATTERN = /^[a-z0-9_][a-z0-9_.-]{1,39}$/u;

async function resolveSuggestedHandle(token: string): Promise<string | null> {
  if (token.length > 1024 || !TOKEN_PATTERN.test(token)) return null;
  const configured = process.env.MASANAWA_PUBLIC_GATEWAY_URL;
  if (!configured) return null;
  let base: URL;
  try {
    base = new URL(configured);
    if (base.protocol !== "https:" || base.username || base.password ||
        base.search || base.hash || base.pathname !== "/") return null;
  } catch { return null; }
  try {
    const url = new URL("/invites/" + encodeURIComponent(token), base);
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const handle = (data as Record<string, unknown>).suggestedHandle;
    return typeof handle === "string" && HANDLE_PATTERN.test(handle) ? handle : null;
  } catch {
    // Same generic result for unknown, invalid, expired, or unavailable.
    return null;
  }
}

export default async function PersonalInvitePage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const handle = await resolveSuggestedHandle(token);
  return (
    <main style={{ maxWidth: 560, padding: "36px 20px", margin: "0 auto", lineHeight: 1.55 }}>
      <h1>Masanawa invitation</h1>
      {handle ? (
        <>
          <p>You have been invited to explore Masanawa.</p>
          <p>After signing in, you may search for <strong>@{handle}</strong> by
            exact handle in Contacts and choose whether to send a request.</p>
          <p>This invitation does not verify someone&apos;s identity, accept
            a contact request, start a conversation, or create a referral reward.</p>
        </>
      ) : (
        <p>This invitation cannot be opened. It may have expired, become
          unavailable, or the service may be temporarily unreachable.
          You can still join Masanawa without it.</p>
      )}
      <p>Use the Masanawa app on your phone to sign in securely.
        Never enter an OTP or pay on an invitation page.</p>
      <Link href="/invite">View general invitation</Link>
    </main>
  );
}
