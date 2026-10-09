import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Masanawa",
  description: "Join Masanawa to explore public Talks and connect by choice.",
  robots: { index: true, follow: true },
};

/** Public web fallback. Never treats a link as identity verification. */
export default function InviteLanding() {
  return (
    <main style={{ maxWidth: 560, padding: "36px 20px", margin: "0 auto", lineHeight: 1.55 }}>
      <h1>Join Masanawa</h1>
      <p>Listen to public Talks, discover experts, and choose who to connect with.</p>
      <p>
        Open Masanawa on your phone and sign in through the usual secure process.
        No account or contact request is created just by opening this invitation.
      </p>
      <p>
        If the app is not installed, use Masanawa&apos;s official installation
        instructions. This page does not request passwords, OTPs, or payments.
      </p>
      <p>
        <a href="/">Masanawa home</a>
      </p>
    </main>
  );
}
