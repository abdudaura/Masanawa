import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { createTalkAiSeatQuote, type TalkAiSeatQuote } from "@masanawa/commerce";
import { createPostgresTalkAiSeatRepository } from "./postgres_repository.js";

interface RecordedQuery {
  text: string;
  values?: unknown[] | undefined;
}

function fixture(safetyAllowed: boolean, existingQuote?: TalkAiSeatQuote) {
  const calls: RecordedQuery[] = [];
  let releases = 0;
  const persona = {
    public_id: "expert_gwani",
    display_name: "Gwani",
    kind: "expert",
    role: "Conversation guide",
    avatar_url: null,
    topics_json: ["conversation"],
    is_available: true,
    safety_allowed: safetyAllowed,
    twin_owner_user_id: null,
  };
  const query = async <Row>(text: string, values?: unknown[] | undefined) => {
    calls.push({ text, values });
    if (text.includes("FROM talks.talks t")) {
      return { rowCount: 1, rows: [{
        host_user_id: createCanonicalId("user"),
        host_name: "Human Host",
        state: "live",
        started_at: "2026-10-08T05:00:00Z",
        live_state: "live",
      }] as unknown as Row[] };
    }
    if (text.includes("FROM commerce.talk_ai_seat_quotes") && existingQuote) {
      return { rowCount: 1, rows: [{definition:existingQuote,request_id:"request_existing"}] as unknown as Row[] };
    }
    if (text.includes("FROM talks.persona_profiles p")) {
      return { rowCount: 1, rows: [persona] as unknown as Row[] };
    }
    if (text.includes("FROM talks.talk_seats")) {
      return { rowCount: 0, rows: [] as Row[] };
    }
    return { rowCount: 0, rows: [] as Row[] };
  };
  const pool = {
    query,
    async connect() {
      return {
        query,
        release() { releases += 1; },
      };
    },
  };
  return {
    repository: createPostgresTalkAiSeatRepository(pool as never),
    calls,
    get releases() { return releases; },
  };
}

describe("AI Seat moderation and financial authorization boundary", () => {
  it("removes persona restrictions inside the authoritative candidate SQL rather than only hiding a card", async () => {
    const f = fixture(true);
    await f.repository.listCandidates({ tenantId: "tenant-a", talkId: "talk-a" });
    const listing = f.calls.find((call) =>
      call.text.includes("FROM talks.persona_profiles p"),
    );
    expect(listing?.text).toContain("talks.safety_enforcement se");
    expect(listing?.text).toContain("se.target_kind='persona'");
    expect(listing?.text).toContain("se.target_id=p.public_id");
    expect(listing?.text).toContain("se.visibility IN ('restricted','blocked')");
    expect(f.calls.some((call) => call.text === "COMMIT")).toBe(true);
    expect(f.releases).toBe(1);
  });

  it("rejects a moderated persona before a new quote can be persisted", async () => {
    const f = fixture(false);
    await expect(f.repository.createQuote({
      tenantId: createCanonicalId("tenant"),
      talkId: "talk-a",
      personaId: "expert_gwani",
      mode: "host_add",
      payerUserId: createCanonicalId("user"),
      now: "2026-10-08T06:00:00Z",
      pricing: {
        expertPriceCredits: 100,
        twinPriceCredits: 120,
        hostShareBasisPoints: 2000,
        twinOwnerShareBasisPoints: 5000,
        quoteTtlSeconds: 120,
      },
    })).rejects.toThrow("talks.persona_unavailable");
    const guard = f.calls.findIndex((call) => call.text.includes("pg_advisory_xact_lock"));
    const check = f.calls.findIndex((call) => call.text.includes("FROM talks.persona_profiles p"));
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(check).toBeGreaterThan(guard);
    expect(f.calls[guard]?.text).toContain("hashtext($1::text),hashtext($2::text)");
    expect(f.calls.some((call) => call.text.includes("INSERT INTO commerce.talk_ai_seat_quotes"))).toBe(false);
    expect(f.calls.some((call) => call.text === "ROLLBACK")).toBe(true);
    expect(f.releases).toBe(1);
  });

  it("does not expose an AI runtime dispatch seat after restriction", async () => {
    const f = fixture(false);
    const seat = await f.repository.readRuntimeSeat({
      tenantId: "tenant-a", talkId: "talk-a", requestId: "request-a",
    });
    expect(seat).toBeNull();
    const query = f.calls.find((call) => call.text.includes("FROM talks.talk_seats"));
    expect(query?.text).toContain("talks.safety_enforcement se");
    expect(query?.text).toContain("se.target_id=talks.talk_seats.persona_id");
    expect(query?.values).toEqual(["tenant-a", "talk-a", "seat_request-a"]);
  });
 
  it("rejects confirmation of a pre-restriction quote without debiting held Credits", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const quote = createTalkAiSeatQuote({
      tenantId,
      quoteId: createCanonicalId("quote"),
      talkId: "talk-a",
      personaId: "expert_gwani",
      personaKind: "expert",
      mode: "host_add",
      payerUserId: userId,
      hostUserId: userId,
      twinOwnerUserId: null,
      priceCredits: 100,
      hostShareCredits: 20,
      twinOwnerShareCredits: 0,
      platformShareCredits: 80,
      createdAt: "2026-10-08T05:00:00.000Z" as never,
      expiresAt: "2026-10-08T06:30:00.000Z" as never,
    });
    const f = fixture(false, quote);
    await expect(f.repository.confirm({
      tenantId,
      payerUserId: userId,
      talkId: "talk-a",
      quoteId: quote.quoteId,
      now: "2026-10-08T06:00:00.000Z",
    })).rejects.toThrow("talks.persona_unavailable");
    const lockedQuote = f.calls.findIndex((call) =>
      call.text.includes("FROM commerce.talk_ai_seat_quotes"),
    );
    const guard = f.calls.findIndex((call) =>
      call.text.includes("pg_advisory_xact_lock"),
    );
    const persona = f.calls.findIndex((call) =>
      call.text.includes("FROM talks.persona_profiles p"),
    );
    expect(lockedQuote).toBeGreaterThanOrEqual(0);
    expect(guard).toBeGreaterThan(lockedQuote);
    expect(persona).toBeGreaterThan(guard);
    expect(f.calls.some((call) => call.text.includes("INSERT INTO commerce.ledger"))).toBe(false);
    expect(f.calls.some((call) => call.text.includes("UPDATE commerce.talk_ai_seat_quotes"))).toBe(false);
    expect(f.calls.some((call) => call.text === "ROLLBACK")).toBe(true);
  });
});
