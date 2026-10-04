import { createHmac } from "node:crypto";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import { createTelegramIngress, createWhatsAppIngress, type ChannelIngressRecord, type DurableChannelAdmission } from "./index.js";

const at = toInstant("2026-10-04T16:00:00Z");
const later = toInstant("2026-10-04T16:02:00Z");
const accountId = createCanonicalId("channel-account");
const appSecret = "fixture-app-secret";
const secret = "fixture_webhook_secret";
const sender = "2348012345678";

function body(value: unknown) { return Buffer.from(JSON.stringify(value)); }
function signature(raw: Uint8Array) {
  return `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
}
function admission() {
  return { admitBatch: vi.fn(async (_records: readonly ChannelIngressRecord[]) => ({ outcome: "persisted" as const })) };
}
function whatsapp(port: DurableChannelAdmission = admission(), id = accountId) {
  return createWhatsAppIngress({ accountId: id, businessAccountId: "business-1", phoneNumberId: "phone-1",
    appSecret, verifyToken: "fixture-verify", admission: port });
}
function waMessage(extra: Record<string, unknown> = {}) {
  return { from: sender, id: "wamid.fixture", timestamp: "1791129600", type: "text", text: { body: "Teach me fractions" }, ...extra };
}
function waPayload(messages: unknown[] = [waMessage()], statuses?: unknown[]) {
  return { object: "whatsapp_business_account", entry: [{ id: "business-1", changes: [{
    field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "phone-1" }, messages,
      ...(statuses === undefined ? {} : { statuses }) },
  }] }] };
}
function telegram(port: DurableChannelAdmission = admission(), id = accountId) {
  return createTelegramIngress({ accountId: id, botId: "9001", webhookSecret: secret, admission: port });
}
function tgMessage(extra: Record<string, unknown> = {}) {
  return { message_id: 15, date: 1791129600, from: { id: 123, is_bot: false },
    chat: { id: 123, type: "private" }, text: "Sannu", ...extra };
}
function first(port: ReturnType<typeof admission>) {
  return port.admitBatch.mock.calls[0]![0][0]!;
}

describe("WhatsApp authenticated ingress", () => {
  it("verifies the subscription challenge without exposing a secret", () => {
    const adapter = whatsapp();
    expect(adapter.verifySubscription({ "hub.mode": "subscribe", "hub.verify_token": "fixture-verify", "hub.challenge": "123456" })).toBe("123456");
    expect(() => adapter.verifySubscription({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "123" }))
      .toThrowError(expect.objectContaining({ code: "channels.verification_failed" }));
    expect(() => adapter.verifySubscription({ "hub.mode": "subscribe", "hub.verify_token": "fixture-verify", "hub.challenge": "<script>" }))
      .toThrowError(expect.objectContaining({ code: "channels.invalid_challenge" }));
  });

  it("normalizes a signed text turn using only transport-verified external references", async () => {
    const port = admission();
    const raw = body(waPayload());
    expect(await whatsapp(port).receive(raw, signature(raw), at)).toEqual({ statusCode: 200, admittedRecords: 1, ignoredEvents: 0 });
    const value = first(port);
    expect(value.event).toMatchObject({ kind: "message", messageId: "wamid.fixture", content: { kind: "text", text: "Teach me fractions" },
      subject: { value: sender, accountId, subjectKind: "user", authenticationStrength: "transport-verified" } });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.event)).toBe(true);
    if (value.event.kind === "message") expect(Object.isFrozen(value.event.content)).toBe(true);
    expect(JSON.stringify(value)).not.toContain(appSecret);
  });

  it.each([undefined, ["bad", "duplicate"], "sha256=bad", `sha256=${"0".repeat(64)}`])("rejects missing, duplicate or malformed signatures before admission (%s)", async header => {
    const port = admission();
    await expect(whatsapp(port).receive(body(waPayload()), header, at)).rejects.toMatchObject({ category: "authentication" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("checks exact raw bytes, not reserialized JSON", async () => {
    const port = admission();
    const raw = body(waPayload());
    await expect(whatsapp(port).receive(Buffer.concat([raw, Buffer.from(" ")]), signature(raw), at))
      .rejects.toMatchObject({ code: "channels.verification_failed" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it.each(["business", "phone"])("rejects a signed batch for another configured %s account", async field => {
    const payload = waPayload();
    if (field === "business") payload.entry[0]!.id = "other-business";
    else payload.entry[0]!.changes[0]!.value.metadata.phone_number_id = "other-phone";
    const port = admission();
    const raw = body(payload);
    await expect(whatsapp(port).receive(raw, signature(raw), at)).rejects.toMatchObject({ code: "channels.account_mismatch" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it.each([
    { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "opaque-action", title: "Pay 1" } } },
    { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "opaque-action", title: "Forged title" } } },
    { type: "button", button: { payload: "opaque-action", text: "Pay 1" } },
  ])("keeps action IDs opaque and drops labels and monetary claims", async extra => {
    const port = admission();
    const raw = body(waPayload([waMessage(extra)]));
    await whatsapp(port).receive(raw, signature(raw), at);
    expect(first(port).event).toMatchObject({ content: { kind: "selection", selectionId: "opaque-action" } });
    expect(JSON.stringify(first(port))).not.toContain("Pay 1");
    expect(JSON.stringify(first(port))).not.toContain("Forged title");
  });

  it.each(["audio", "image", "video", "document"])("preserves %s as an account-scoped file reference without downloading it", async type => {
    const port = admission();
    const raw = body(waPayload([waMessage({ type, [type]: { id: "provider-file", mime_type: "application/octet-stream", caption: "Example" },
      context: { id: "quoted-message", from: "another-user" } })]));
    await whatsapp(port).receive(raw, signature(raw), at);
    expect(first(port).event).toMatchObject({ replyToMessageId: "quoted-message", content: {
      kind: "media", mediaKind: type, fileId: "provider-file", caption: "Example",
    } });
    expect(JSON.stringify(first(port))).not.toContain("another-user");
  });

  it("separates successive delivery statuses from user turns", async () => {
    const port = admission();
    const statuses = ["sent", "delivered", "read", "failed"].map(status => ({
      id: "outbound-1", recipient_id: sender, timestamp: "1791129600", status,
      errors: [{ message: "private-provider-error" }],
    }));
    const raw = body(waPayload([], statuses));
    await whatsapp(port).receive(raw, signature(raw), at);
    const records = port.admitBatch.mock.calls[0]![0];
    expect(records).toHaveLength(4);
    expect(new Set(records.map(r => r.dedupeKey)).size).toBe(4);
    expect(records.every(r => r.event.kind === "delivery")).toBe(true);
    expect(JSON.stringify(records)).not.toContain("private-provider-error");
  });

  it("validates every event before persisting any part of a batch", async () => {
    const port = admission();
    const raw = body(waPayload([waMessage(), waMessage({ id: "next", from: "" })]));
    await expect(whatsapp(port).receive(raw, signature(raw), at)).rejects.toMatchObject({ code: "channels.invalid_payload" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("retains unsupported direct messages for an explicit recovery response", async () => {
    const port = admission();
    const raw = body(waPayload([waMessage({ type: "sticker", sticker: { id: "not-copied" } })]));
    await whatsapp(port).receive(raw, signature(raw), at);
    expect(first(port).event).toMatchObject({ content: { kind: "unsupported", providerType: "sticker" } });
    expect(JSON.stringify(first(port))).not.toContain("not-copied");
  });
});

describe("Telegram authenticated ingress", () => {
  it.each([undefined, "wrong", [secret]])("rejects absent or invalid dedicated webhook secret (%s)", async header => {
    const port = admission();
    await expect(telegram(port).receive(body({ update_id: 1, message: tgMessage() }), header, at)).rejects.toMatchObject({ category: "authentication" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("uses exact update IDs without sequential ordering assumptions", async () => {
    const port = admission();
    await telegram(port).receive(body({ update_id: 50, message: tgMessage() }), secret, at);
    await telegram(port).receive(body({ update_id: 2, message: tgMessage() }), secret, later);
    expect(first(port).externalEventId).toBe("update:50");
    expect(port.admitBatch.mock.calls[1]![0][0]!.externalEventId).toBe("update:2");
    expect(first(port).event).toMatchObject({ subject: { value: "123", authenticationStrength: "transport-verified" },
      conversation: { conversationKind: "direct", namespace: "9001" } });
  });

  it.each(["group", "supergroup", "channel"])("ignores %s input without invoking private admission", async type => {
    const port = admission();
    const result = await telegram(port).receive(body({ update_id: 1, message: tgMessage({ chat: { id: -10, type } }) }), secret, at);
    expect(result).toEqual({ statusCode: 200, admittedRecords: 0, ignoredEvents: 1 });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("rejects mismatched private sender/chat and unsafe numeric identifiers", async () => {
    const port = admission();
    await expect(telegram(port).receive(body({ update_id: 1, message: tgMessage({ chat: { id: 456, type: "private" } }) }), secret, at))
      .rejects.toMatchObject({ code: "channels.subject_mismatch" });
    await expect(telegram(port).receive(body({ update_id: Number.MAX_SAFE_INTEGER + 1, message: tgMessage() }), secret, at))
      .rejects.toMatchObject({ code: "channels.invalid_payload" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("keeps edits distinct from new turns and retains the external original message reference", async () => {
    const port = admission();
    await telegram(port).receive(body({ update_id: 1, edited_message: tgMessage({ edit_date: 1791129700,
      reply_to_message: { message_id: 9, text: "private quoted content" } }) }), secret, at);
    expect(first(port).event).toMatchObject({ edited: true, messageId: "15", replyToMessageId: "9" });
    expect(JSON.stringify(first(port))).not.toContain("private quoted content");
  });

  it("normalizes a callback from the configured bot in the sender's private conversation", async () => {
    const port = admission();
    const callback = { id: "callback-1", from: { id: 123, is_bot: false }, data: "opaque-quote",
      message: tgMessage({ from: { id: 9001, is_bot: true }, date: 0 }) };
    await telegram(port).receive(body({ update_id: 2, callback_query: callback }), secret, at);
    expect(first(port).event).toMatchObject({ callbackQueryId: "callback-1", content: { kind: "selection", selectionId: "opaque-quote" } });
    expect(first(port).event).not.toHaveProperty("providerTimestamp");
    callback.message.from.id = 9002;
    await expect(telegram(port).receive(body({ update_id: 3, callback_query: callback }), secret, at))
      .rejects.toMatchObject({ code: "channels.account_mismatch" });
  });

  it("rejects callback data above the provider byte limit", async () => {
    const callback = { id: "callback", from: { id: 123, is_bot: false }, data: "🙂".repeat(17),
      message: tgMessage({ from: { id: 9001, is_bot: true } }) };
    await expect(telegram().receive(body({ update_id: 1, callback_query: callback }), secret, at))
      .rejects.toMatchObject({ code: "channels.invalid_payload" });
  });

  it("does not turn inline callbacks, bots or unrelated updates into private user turns", async () => {
    const port = admission();
    for (const update of [
      { update_id: 1, callback_query: { id: "inline", inline_message_id: "x", data: "x" } },
      { update_id: 2, message: tgMessage({ from: { id: 999, is_bot: true } }) },
      { update_id: 3, my_chat_member: { private: "discard" } },
    ]) expect((await telegram(port).receive(body(update), secret, at)).admittedRecords).toBe(0);
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it.each(["voice", "audio", "video", "document"])("normalizes %s without copying filenames or file URLs", async type => {
    const port = admission();
    const message = tgMessage({ text: undefined, [type]: { file_id: "file-1", file_name: "private-name",
      file_path: "https://attacker.example" }, caption: "My question" });
    await telegram(port).receive(body({ update_id: 1, message }), secret, at);
    expect(first(port).event).toMatchObject({ content: { kind: "media", fileId: "file-1", caption: "My question" } });
    expect(JSON.stringify(first(port))).not.toContain("attacker");
    expect(JSON.stringify(first(port))).not.toContain("private-name");
  });

  it("chooses the largest photo and ignores provider array ordering", async () => {
    const port = admission();
    const message = tgMessage({ text: undefined, photo: [
      { file_id: "large", width: 1280, height: 720 }, { file_id: "small", width: 100, height: 100 },
    ] });
    await telegram(port).receive(body({ update_id: 1, message }), secret, at);
    expect(first(port).event).toMatchObject({ content: { kind: "media", fileId: "large" } });
  });
});

describe("custody, replay and bounded private evidence", () => {
  it("never acknowledges before the durable admission promise resolves", async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const port = { admitBatch: vi.fn(async () => { await waiting; return { outcome: "persisted" as const }; }) };
    let acknowledged = false;
    const pending = telegram(port).receive(body({ update_id: 1, message: tgMessage() }), secret, at).then(value => {
      acknowledged = true;
      return value;
    });
    await Promise.resolve();
    expect(port.admitBatch).toHaveBeenCalledOnce();
    expect(acknowledged).toBe(false);
    release();
    expect((await pending).statusCode).toBe(200);
  });

  it("redacts persistence failures and permits provider retry", async () => {
    const port = { admitBatch: vi.fn(async () => { throw new Error("secret database password"); }) };
    try {
      await telegram(port).receive(body({ update_id: 1, message: tgMessage() }), secret, at);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "channels.persistence_unavailable", category: "unavailable", retryable: true });
      expect(JSON.stringify(error)).not.toContain("password");
    }
  });

  it("keeps account-scoped keys and stable replay evidence across receive times and whitespace", async () => {
    const port = admission();
    const update = { update_id: 7, message: tgMessage() };
    await telegram(port).receive(body(update), secret, at);
    await telegram(port).receive(Buffer.from(JSON.stringify(update, null, 2)), secret, later);
    const one = first(port), two = port.admitBatch.mock.calls[1]![0][0]!;
    expect(one.dedupeKey).toBe(two.dedupeKey);
    expect(one.evidenceHash).toBe(two.evidenceHash);
    expect(one.receivedAt).not.toBe(two.receivedAt);
    await telegram(port, createCanonicalId("channel-account")).receive(body(update), secret, at);
    expect(port.admitBatch.mock.calls[2]![0][0]!.dedupeKey).not.toBe(one.dedupeKey);
    await telegram(port).receive(body({ ...update, message: tgMessage({ text: "changed" }) }), secret, at);
    const changed = port.admitBatch.mock.calls[3]![0][0]!;
    expect(changed.dedupeKey).toBe(one.dedupeKey);
    expect(changed.evidenceHash).not.toBe(one.evidenceHash);
  });

  it("accepts durable duplicate evidence without a process-local cache", async () => {
    const port = { admitBatch: vi.fn(async () => ({ outcome: "duplicate" as const })) };
    expect((await telegram(port).receive(body({ update_id: 1, message: tgMessage() }), secret, at)).statusCode).toBe(200);
  });

  it("rejects a lying or malformed admission outcome", async () => {
    const port = { admitBatch: vi.fn(async () => ({ outcome: "queued" })) };
    await expect(telegram(port as never).receive(body({ update_id: 1, message: tgMessage() }), secret, at))
      .rejects.toMatchObject({ code: "channels.persistence_unavailable" });
  });

  it.each([Buffer.alloc(0), Buffer.alloc(1_048_577), Buffer.from("{"), Buffer.from([0xff])])("rejects empty/oversized/malformed/non-UTF8 bodies", async raw => {
    const port = admission();
    await expect(telegram(port).receive(raw, secret, at)).rejects.toMatchObject({ category: "validation" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("bounds event batches and rejects conflicting event IDs within a single delivery", async () => {
    const port = admission();
    for (const messages of [Array.from({ length: 129 }, (_, i) => waMessage({ id: `id-${i}` })), [waMessage(), waMessage({ text: { body: "changed" } })]]) {
      const raw = body(waPayload(messages));
      await expect(whatsapp(port).receive(raw, signature(raw), at)).rejects.toMatchObject({ category: "validation" });
    }
    expect(port.admitBatch).not.toHaveBeenCalled();
  });

  it("coalesces identical repeated events in one delivery before durable admission", async () => {
    const port = admission();
    const raw = body(waPayload([waMessage(), waMessage()]));
    expect((await whatsapp(port).receive(raw, signature(raw), at)).admittedRecords).toBe(1);
    expect(port.admitBatch).toHaveBeenCalledOnce();
    expect(port.admitBatch.mock.calls[0]![0]).toHaveLength(1);
  });

  it("rejects malformed media and ambiguous Telegram payloads instead of guessing", async () => {
    const port = admission();
    for (const update of [
      { update_id: 1, message: tgMessage({ text: undefined, voice: { file_id: "" } }) },
      { update_id: 2, message: tgMessage(), edited_message: tgMessage() },
    ]) await expect(telegram(port).receive(body(update), secret, at)).rejects.toMatchObject({ code: "channels.invalid_payload" });
    expect(port.admitBatch).not.toHaveBeenCalled();
  });
});
