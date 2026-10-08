"use client";

import { useEffect, useState } from "react";
import "./deletion.css";

type DeletionPhase =
  | "requested" | "identity-verified" | "awaiting-settlement"
  | "processing" | "completed" | "failed";

interface RequestStatus {
  requestId: string;
  phase: DeletionPhase;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

type Stage = "contact" | "login-code" | "ready" | "deletion-code" | "status";

const messages: Record<string, string> = {
  UNAUTHORIZED: "Your secure session expired. Start again with a new sign-in code.",
  SIGN_IN_REQUIRED: "Sign in to continue your deletion request.",
  OTP_INVALID: "That sign-in code is incorrect or has expired.",
  OTP_LOCKED: "Too many incorrect sign-in codes. Request another when permitted.",
  OTP_RATE_LIMITED: "A code was sent recently. Please wait before trying again.",
  ACCOUNT_DELETION_CODE_INVALID: "The deletion verification code is incorrect.",
  ACCOUNT_DELETION_CODE_EXPIRED: "The deletion verification code has expired.",
  ACCOUNT_DELETION_CODE_LOCKED: "Too many incorrect deletion codes. Request another when permitted.",
  ACCOUNT_DELETION_CODE_RATE_LIMITED: "A deletion code was sent recently. Please wait before requesting another.",
  ACCOUNT_DELETION_STATE_CONFLICT: "This request changed. Refresh its status before continuing.",
  ACCOUNT_DELETION_ALREADY_VERIFIED: "This request is already verified. Refresh its status.",
  ACCOUNT_DELETION_DELIVERY_UNAVAILABLE: "Your request may have been saved, but we could not deliver a code. Check again later.",
  ACCOUNT_SERVICE_NOT_CONFIGURED: "This request service is not enabled on this website.",
  ACCOUNT_SERVICE_UNAVAILABLE: "The account service is temporarily unavailable. Your request status has not been changed here.",
  NAME_REQUIRED_ON_SIGNUP: "We could not verify an existing account using those details.",
};

function isRequest(value: unknown): value is RequestStatus {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.requestId === "string" && typeof v.phase === "string" &&
    ["requested", "identity-verified", "awaiting-settlement", "processing", "completed", "failed"].includes(v.phase) &&
    typeof v.revision === "number" && typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string";
}

async function call(action: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const result = await fetch(`/api/delete-account/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const payload: unknown = await result.json().catch(() => null);
  const parsed = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  if (!result.ok) {
    const code = typeof parsed.code === "string" ? parsed.code : "ACCOUNT_SERVICE_UNAVAILABLE";
    throw new Error(messages[code] ?? "Unable to complete this request. Please try again.");
  }
  return parsed;
}

export default function DeleteAccountPage() {
  const [stage, setStage] = useState<Stage>("contact");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [deletionCode, setDeletionCode] = useState("");
  const [request, setRequest] = useState<RequestStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const identifier = () => {
    const value = contact.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) return { email: value };
    if (/^\+[1-9]\d{6,14}$/u.test(value)) return { phone: value };
    throw new Error("Enter your registered email or a phone number with a + country code.");
  };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function showStatus(status: RequestStatus | null) {
    setRequest(status);
    setStage(status ? status.phase === "requested" ? "deletion-code" : "status" : "ready");
  }

  async function loadStatus() {
    const data = await call("status");
    const value = data.request;
    if (value !== null && value !== undefined && !isRequest(value)) {
      throw new Error("The account service returned an invalid request status.");
    }
    showStatus(isRequest(value) ? value : null);
  }

  useEffect(() => {
    // A narrow, short-lived HttpOnly cookie may exist from this browser session.
    // Never load or store actual access credentials in JavaScript.
    void call("status")
      .then((data) => {
        if (isRequest(data.request)) showStatus(data.request);
        else setStage("ready");
      })
      .catch(() => {
        // No active external request session. OTP sign-in is always available.
      });
  }, []);

  async function sendLoginCode() {
    await run(async () => {
      await call("send-signin-code", identifier());
      setStage("login-code");
      setNotice("A sign-in code was sent to your registered contact.");
    });
  }

  async function verifyLoginCode() {
    await run(async () => {
      if (!/^\d{6}$/u.test(code)) throw new Error("Enter the six-digit sign-in code.");
      await call("verify-signin-code", { ...identifier(), code });
      setCode("");
      await loadStatus();
    });
  }

  async function requestDeletion() {
    await run(async () => {
      const data = await call("request");
      if (!isRequest(data.request)) throw new Error("Request status could not be verified.");
      showStatus(data.request);
      if (data.request.phase === "failed" && data.verificationSent === true) {
        // Preserve the same durable request ID; the new challenge only
        // re-verifies its owner and never clears outstanding obligations.
        setStage("deletion-code");
      }
      setNotice(data.verificationSent === true
        ? "A separate deletion-verification code has been sent."
        : "Your request is recorded, but verification delivery is currently unavailable.");
    });
  }

  async function verifyDeletion() {
    await run(async () => {
      if (!/^\d{6}$/u.test(deletionCode)) throw new Error("Enter the six-digit deletion code.");
      const data = await call("verify-deletion", { code: deletionCode });
      if (!isRequest(data.request)) throw new Error("Request status could not be verified.");
      setDeletionCode("");
      showStatus(data.request);
      setNotice("Ownership verified. This does not mean your account has been deleted.");
    });
  }

  async function endSession() {
    await run(async () => {
      await call("end-session");
      setStage("contact");
      setContact("");
      setCode("");
      setDeletionCode("");
      setRequest(null);
      setNotice("Your temporary browser session has ended.");
    });
  }

  return (
    <main className="deletion-shell">
      <div className="deletion-brand">Masanawa</div>
      <section className="deletion-panel" aria-labelledby="delete-title">
        <p className="deletion-eyebrow">Account & privacy</p>
        <h1 id="delete-title">Request account deletion</h1>
        <p className="deletion-description">
          You can request deletion without the Android app. Verify your registered
          email or phone number first. Pending financial settlements, lawful retention
          and public Talk content may require separate handling.
        </p>
        {stage === "contact" && (
          <div className="deletion-form">
            <label htmlFor="deletion-contact">Registered email or phone</label>
            <input id="deletion-contact" autoComplete="username" value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="email@example.com or +234..." disabled={busy} />
            <button onClick={() => void sendLoginCode()} disabled={busy}>Send sign-in code</button>
          </div>
        )}
        {stage === "login-code" && (
          <div className="deletion-form">
            <label htmlFor="signin-code">Sign-in code</label>
            <input id="signin-code" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} value={code} disabled={busy}
              onChange={(event) => setCode(event.target.value.replace(/\D/gu, ""))} />
            <button onClick={() => void verifyLoginCode()} disabled={busy}>Verify sign-in</button>
            <button className="deletion-secondary" onClick={() => void sendLoginCode()} disabled={busy}>Send another code</button>
          </div>
        )}
        {stage === "ready" && (
          <div className="deletion-form">
            <p>
              Requesting deletion starts a tracked review. It does not automatically
              erase payment records or end an active financial obligation.
            </p>
            <button onClick={() => void requestDeletion()} disabled={busy}>Request deletion</button>
          </div>
        )}
        {stage === "deletion-code" && (
          <div className="deletion-form">
            <p>Your request is recorded. Enter the separate deletion code to verify ownership.</p>
            <label htmlFor="deletion-code">Deletion verification code</label>
            <input id="deletion-code" inputMode="numeric" maxLength={6}
              autoComplete="one-time-code" value={deletionCode} disabled={busy}
              onChange={(event) => setDeletionCode(event.target.value.replace(/\D/gu, ""))} />
            <button onClick={() => void verifyDeletion()} disabled={busy}>Verify deletion request</button>
            <button className="deletion-secondary" onClick={() => void requestDeletion()} disabled={busy}>Send another deletion code</button>
          </div>
        )}
        {stage === "status" && request && (
          <div className="deletion-form" aria-live="polite">
            <h2>{request.phase === "completed" ? "Deletion completed" :
              request.phase === "failed" ? "Request needs attention" :
              "Request received and verified"}</h2>
            <p>{request.phase === "completed"
              ? "The server has confirmed the deletion process is complete."
              : "Your request remains pending. Your account is not confirmed deleted. Some records may be retained for legally required reasons."}</p>
            <p className="deletion-reference">Reference: {request.requestId}</p>
            {request.phase === "failed" && (
              <button onClick={() => void requestDeletion()} disabled={busy}>
                Request new verification code
              </button>
            )}
            <button className="deletion-secondary" onClick={() => void run(loadStatus)} disabled={busy}>Refresh status</button>
          </div>
        )}
        {busy && <p role="status" className="deletion-notice">Contacting Masanawa securely…</p>}
        {notice && <p role="status" className="deletion-notice">{notice}</p>}
        {error && <p role="alert" className="deletion-error">{error}</p>}
        {stage !== "contact" && (
          <button className="deletion-logout" onClick={() => void endSession()} disabled={busy}>
            End this secure session
          </button>
        )}
      </section>
      <p className="deletion-footer">
        Never share codes with a person, AI agent or chat. Sign-in and deletion
        verification use different codes. Your request status is authoritative only
        when returned by Masanawa.
      </p>
    </main>
  );
}
