import { describe, expect, it } from "vitest";
import {
  admitContentPerception,
  type PerceptionAdmissionEnvelope,
} from "../../packages/perception/src/content-admission.js";

const envelope: PerceptionAdmissionEnvelope = {
  perceptionEventId: "event_0199f0a0-0000-7000-8000-000000000101",
  tenantId: "tenant_0199f0a0-0000-7000-8000-000000000102",
  source: {
    kind: "app",
    sourceId: "mobile-chat",
    deviceId: null,
    channelAccountId: null,
  },
  subject: {
    userId: "user_0199f0a0-0000-7000-8000-000000000103",
    relationshipId: "relationship_0199f0a0-0000-7000-8000-000000000104",
    characterId: "character_0199f0a0-0000-7000-8000-000000000105",
  },
  permission: {
    authorityContextId: "authority-context_0199f0a0-0000-7000-8000-000000000106",
    basis: "user-action",
    revision: 1,
    purposes: ["conversation"],
  },
  privacy: {
    scope: "relationship",
    retention: "session",
    memoryPromotion: "forbidden",
  },
  upstreamEventId: "msg-12345",
  observedAt: "2026-10-06T10:00:00.000Z",
  receivedAt: "2026-10-06T10:00:01.000Z",
};

describe("content perception admission", () => {
  it("admits bounded inline text and preserves permission scope", () => {
    const event = admitContentPerception({
      envelope,
      content: { kind: "text", text: "  Hello Gwani  ", language: "EN" },
    });
    expect(event).toMatchObject({
      kind: "text",
      dedupeKey: "app:mobile-chat:msg-12345",
      permission: { basis: "user-action", purposes: ["conversation"] },
      payload: {
        mediaType: "text/plain",
        inlineText: "Hello Gwani",
        contentRef: null,
        attributes: { language: "en" },
      },
    });
  });

  it("rejects empty and oversized text before canonical admission", () => {
    expect(() =>
      admitContentPerception({
        envelope,
        content: { kind: "text", text: "   " },
      }),
    ).toThrow("text must be between");

    expect(() =>
      admitContentPerception({
        envelope,
        content: { kind: "text", text: "x".repeat(128_001) },
      }),
    ).toThrow("text must be between");
  });

  it("admits a bounded PDF document by content reference without copying raw bytes", () => {
    const event = admitContentPerception({
      envelope: { ...envelope, upstreamEventId: "upload-9001" },
      content: {
        kind: "document",
        contentRef: "media://document/upload-9001",
        mediaType: "APPLICATION/PDF",
        sizeBytes: 1_048_576,
        fileName: "application.pdf",
      },
    });
    expect(event).toMatchObject({
      kind: "document",
      dedupeKey: "app:mobile-chat:upload-9001",
      payload: {
        mediaType: "application/pdf",
        contentRef: "media://document/upload-9001",
        inlineText: null,
        attributes: {
          fileName: "application.pdf",
          sizeBytes: "1048576",
        },
      },
    });
  });

  it("admits supported generic files but does not relabel them as documents", () => {
    const event = admitContentPerception({
      envelope,
      content: {
        kind: "file",
        contentRef: "media://file/data-1",
        mediaType: "text/csv",
        sizeBytes: 100,
        fileName: "data.csv",
      },
    });
    expect(event.kind).toBe("file");
    expect(event.payload.mediaType).toBe("text/csv");
  });

  it("rejects unsupported MIME types and oversized file payloads", () => {
    expect(() =>
      admitContentPerception({
        envelope,
        content: {
          kind: "file",
          contentRef: "media://file/exe",
          mediaType: "application/x-msdownload",
          sizeBytes: 100,
          fileName: "bad.exe",
        },
      }),
    ).toThrow("mediaType is not admitted");

    expect(() =>
      admitContentPerception({
        envelope,
        content: {
          kind: "document",
          contentRef: "media://document/huge",
          mediaType: "application/pdf",
          sizeBytes: 25 * 1024 * 1024 + 1,
          fileName: "huge.pdf",
        },
      }),
    ).toThrow("sizeBytes");
  });

  it("rejects a non-document MIME type from the document admission path", () => {
    expect(() =>
      admitContentPerception({
        envelope,
        content: {
          kind: "document",
          contentRef: "media://document/not-doc",
          mediaType: "text/csv",
          sizeBytes: 100,
          fileName: "table.csv",
        },
      }),
    ).toThrow("document mediaType is unsupported");
  });

  it("rejects file names containing path traversal separators", () => {
    expect(() =>
      admitContentPerception({
        envelope,
        content: {
          kind: "file",
          contentRef: "media://file/1",
          mediaType: "text/plain",
          sizeBytes: 20,
          fileName: "../secret.txt",
        },
      }),
    ).toThrow("path separators");
  });

  it("builds deterministic dedupe identity from source plus upstream event id", () => {
    const a = admitContentPerception({
      envelope,
      content: { kind: "text", text: "one" },
    });
    const b = admitContentPerception({
      envelope,
      content: { kind: "text", text: "different body" },
    });
    expect(a.dedupeKey).toBe(b.dedupeKey);
  });

  it("preserves Task 109 permission failures rather than bypassing normalization", () => {
    expect(() =>
      admitContentPerception({
        envelope: {
          ...envelope,
          source: {
            kind: "system",
            sourceId: "scheduler",
            deviceId: null,
            channelAccountId: null,
          },
        },
        content: { kind: "text", text: "system event" },
      }),
    ).toThrow("system-policy");
  });
});
