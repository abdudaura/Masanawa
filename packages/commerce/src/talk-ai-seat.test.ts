import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createTalkAiSeatQuote,
  settlementRequired,
  transitionTalkAiSeatQuote,
  type CreateTalkAiSeatQuoteInput,
} from "./talk-ai-seat.js";

const tenantId = createCanonicalId("tenant");
const hostUserId = createCanonicalId("user");
const sponsorUserId = createCanonicalId("user");
const twinOwnerUserId = createCanonicalId("user");
const quoteId = createCanonicalId("quote");
const createdAt = toInstant("2026-10-07T10:00:00.000Z");
const expiresAt = toInstant("2026-10-07T10:05:00.000Z");

function expertInput(
  mode: "host_add" | "sponsor" = "sponsor",
): CreateTalkAiSeatQuoteInput {
  return {
    tenantId,
    quoteId,
    talkId: "talk_public-1",
    personaId: "expert_economist",
    personaKind: "expert",
    mode,
    payerUserId: mode === "host_add" ? hostUserId : sponsorUserId,
    hostUserId,
    twinOwnerUserId: null,
    priceCredits: 100,
    hostShareCredits: 30,
    twinOwnerShareCredits: 0,
    platformShareCredits: 70,
    createdAt,
    expiresAt,
  };
}

function twinInput(): CreateTalkAiSeatQuoteInput {
  return {
    tenantId,
    quoteId: createCanonicalId("quote"),
    talkId: "talk_public-1",
    personaId: "twin_amira",
    personaKind: "twin",
    mode: "sponsor",
    payerUserId: sponsorUserId,
    hostUserId,
    twinOwnerUserId,
    priceCredits: 120,
    hostShareCredits: 24,
    twinOwnerShareCredits: 60,
    platformShareCredits: 36,
    createdAt,
    expiresAt,
  };
}

describe("Talk AI Seat commerce", () => {
  it("creates a bounded fresh Expert quote with exact economics", () => {
    const quote = createTalkAiSeatQuote(expertInput());

    expect(quote).toMatchObject({
      personaKind: "expert",
      mode: "sponsor",
      payerUserId: sponsorUserId,
      hostUserId,
      priceCredits: 100,
      hostShareCredits: 30,
      twinOwnerShareCredits: 0,
      platformShareCredits: 70,
      state: "quoted",
      revision: 1,
    });
    expect(Object.isFrozen(quote)).toBe(true);
  });

  it("rejects invalid role semantics and economics", () => {
    expect(() =>
      createTalkAiSeatQuote({
        ...expertInput("host_add"),
        payerUserId: sponsorUserId,
      }),
    ).toThrow("payer must be the Talk Host");

    expect(() =>
      createTalkAiSeatQuote({
        ...expertInput("sponsor"),
        payerUserId: hostUserId,
      }),
    ).toThrow("audience user");

    expect(() =>
      createTalkAiSeatQuote({
        ...expertInput(),
        hostShareCredits: 31,
      }),
    ).toThrow("sum exactly");

    expect(() =>
      createTalkAiSeatQuote({
        ...expertInput(),
        twinOwnerUserId,
      }),
    ).toThrow("Expert AI Seat");

    expect(() =>
      createTalkAiSeatQuote({
        ...twinInput(),
        twinOwnerUserId: null,
      }),
    ).toThrow("requires twinOwnerUserId");
  });

  it("holds sponsor funds on payer confirmation but does not create admission or earnings", () => {
    const quote = createTalkAiSeatQuote(expertInput());
    const transition = transitionTalkAiSeatQuote(
      quote,
      {
        type: "confirm",
        requestId: "confirm-1",
        expectedRevision: quote.revision,
        actorUserId: sponsorUserId,
      },
      toInstant("2026-10-07T10:01:00.000Z"),
    );

    expect(transition.quote.state).toBe("pending_host");
    expect(transition.quote.admittedAt).toBeNull();
    expect(transition.settlement).toEqual({
      kind: "hold",
      idempotencyKey: `talk-ai-seat:hold:${quote.quoteId}`,
      quoteId: quote.quoteId,
      payerUserId: sponsorUserId,
      amountCredits: 100,
    });
    expect(settlementRequired(transition)).toBe(true);
  });

  it("never lets payment confirmation bypass the real Host", () => {
    const quoted = createTalkAiSeatQuote(expertInput());
    const pending = transitionTalkAiSeatQuote(
      quoted,
      {
        type: "confirm",
        requestId: "confirm-2",
        expectedRevision: quoted.revision,
        actorUserId: sponsorUserId,
      },
      toInstant("2026-10-07T10:01:00.000Z"),
    ).quote;

    expect(() =>
      transitionTalkAiSeatQuote(
        pending,
        {
          type: "admit",
          requestId: "admit-attacker",
          expectedRevision: pending.revision,
          actorUserId: sponsorUserId,
        },
        toInstant("2026-10-07T10:01:10.000Z"),
      ),
    ).toThrow("human Talk Host");

    const admitted = transitionTalkAiSeatQuote(
      pending,
      {
        type: "admit",
        requestId: "admit-host",
        expectedRevision: pending.revision,
        actorUserId: hostUserId,
      },
      toInstant("2026-10-07T10:01:10.000Z"),
    );

    expect(admitted.quote.state).toBe("admitted");
    expect(admitted.settlement).toEqual({
      kind: "capture",
      idempotencyKey: `talk-ai-seat:capture:${quoted.quoteId}`,
      quoteId: quoted.quoteId,
      payerUserId: sponsorUserId,
      amountCredits: 100,
      hostUserId,
      hostShareCredits: 30,
      twinOwnerUserId: null,
      twinOwnerShareCredits: 0,
      platformShareCredits: 70,
    });
  });

  it("captures a Twin Seat with Host, owner and platform shares only on admission", () => {
    const quoted = createTalkAiSeatQuote(twinInput());
    const pending = transitionTalkAiSeatQuote(
      quoted,
      {
        type: "confirm",
        requestId: "confirm-twin",
        expectedRevision: quoted.revision,
        actorUserId: sponsorUserId,
      },
      toInstant("2026-10-07T10:01:00.000Z"),
    ).quote;
    const admitted = transitionTalkAiSeatQuote(
      pending,
      {
        type: "admit",
        requestId: "admit-twin",
        expectedRevision: pending.revision,
        actorUserId: hostUserId,
      },
      toInstant("2026-10-07T10:01:10.000Z"),
    );

    expect(admitted.settlement).toMatchObject({
      kind: "capture",
      amountCredits: 120,
      hostUserId,
      hostShareCredits: 24,
      twinOwnerUserId,
      twinOwnerShareCredits: 60,
      platformShareCredits: 36,
    });
  });

  it("releases the full held amount when the Host declines a sponsored Seat", () => {
    const quoted = createTalkAiSeatQuote(expertInput());
    const pending = transitionTalkAiSeatQuote(
      quoted,
      {
        type: "confirm",
        requestId: "confirm-decline",
        expectedRevision: quoted.revision,
        actorUserId: sponsorUserId,
      },
      toInstant("2026-10-07T10:01:00.000Z"),
    ).quote;
    const declined = transitionTalkAiSeatQuote(
      pending,
      {
        type: "decline",
        requestId: "decline-host",
        expectedRevision: pending.revision,
        actorUserId: hostUserId,
      },
      toInstant("2026-10-07T10:01:30.000Z"),
    );

    expect(declined.quote.state).toBe("declined");
    expect(declined.settlement).toEqual({
      kind: "release",
      idempotencyKey: `talk-ai-seat:release:${quoted.quoteId}`,
      quoteId: quoted.quoteId,
      payerUserId: sponsorUserId,
      amountCredits: 100,
      reason: "declined",
    });
  });

  it("expires an unconfirmed quote without settlement and a held request with full release", () => {
    const quoted = createTalkAiSeatQuote(expertInput());
    const expiredUnheld = transitionTalkAiSeatQuote(
      quoted,
      {
        type: "expire",
        requestId: "expire-unheld",
        expectedRevision: quoted.revision,
      },
      expiresAt,
    );
    expect(expiredUnheld.quote.state).toBe("expired");
    expect(expiredUnheld.settlement).toBeNull();

    const fresh = createTalkAiSeatQuote({
      ...expertInput(),
      quoteId: createCanonicalId("quote"),
    });
    const pending = transitionTalkAiSeatQuote(
      fresh,
      {
        type: "confirm",
        requestId: "confirm-held",
        expectedRevision: fresh.revision,
        actorUserId: sponsorUserId,
      },
      toInstant("2026-10-07T10:01:00.000Z"),
    ).quote;
    const expiredHeld = transitionTalkAiSeatQuote(
      pending,
      {
        type: "expire",
        requestId: "expire-held",
        expectedRevision: pending.revision,
      },
      expiresAt,
    );
    expect(expiredHeld.settlement).toMatchObject({
      kind: "release",
      amountCredits: 100,
      reason: "expired",
    });
  });

  it("models Host-added AI as held pending direct admission, never Host approval", () => {
    const quoted = createTalkAiSeatQuote(expertInput("host_add"));
    const pending = transitionTalkAiSeatQuote(
      quoted,
      {
        type: "confirm",
        requestId: "host-confirm",
        expectedRevision: quoted.revision,
        actorUserId: hostUserId,
      },
      toInstant("2026-10-07T10:01:00.000Z"),
    );

    expect(pending.quote.state).toBe("pending_admission");
    expect(pending.settlement?.kind).toBe("hold");

    const admitted = transitionTalkAiSeatQuote(
      pending.quote,
      {
        type: "admit",
        requestId: "host-admit",
        expectedRevision: pending.quote.revision,
        actorUserId: hostUserId,
      },
      toInstant("2026-10-07T10:01:10.000Z"),
    );
    expect(admitted.quote.state).toBe("admitted");
    expect(admitted.settlement?.kind).toBe("capture");
  });

  it("rejects expired confirmations, stale revisions, non-payer confirmation and terminal replay", () => {
    const quoted = createTalkAiSeatQuote(expertInput());

    expect(() =>
      transitionTalkAiSeatQuote(
        quoted,
        {
          type: "confirm",
          requestId: "wrong-payer",
          expectedRevision: quoted.revision,
          actorUserId: hostUserId,
        },
        toInstant("2026-10-07T10:01:00.000Z"),
      ),
    ).toThrow("quoted payer");

    expect(() =>
      transitionTalkAiSeatQuote(
        quoted,
        {
          type: "confirm",
          requestId: "late-confirm",
          expectedRevision: quoted.revision,
          actorUserId: sponsorUserId,
        },
        expiresAt,
      ),
    ).toThrow("expired");

    expect(() =>
      transitionTalkAiSeatQuote(
        quoted,
        {
          type: "confirm",
          requestId: "stale",
          expectedRevision: quoted.revision + 1,
          actorUserId: sponsorUserId,
        },
        toInstant("2026-10-07T10:01:00.000Z"),
      ),
    ).toThrow("revision conflict");

    const expired = transitionTalkAiSeatQuote(
      quoted,
      {
        type: "expire",
        requestId: "expire-terminal",
        expectedRevision: quoted.revision,
      },
      expiresAt,
    ).quote;
    expect(() =>
      transitionTalkAiSeatQuote(
        expired,
        {
          type: "expire",
          requestId: "expire-again",
          expectedRevision: expired.revision,
        },
        toInstant("2026-10-07T10:06:00.000Z"),
      ),
    ).toThrow("terminal");
  });
});
