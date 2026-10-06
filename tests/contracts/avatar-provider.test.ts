import { describe, expect, it } from "vitest";
import {
  assertAvatarLeaseMatchesPlan,
  planAvatarPresentation,
  type AvatarPresentationRequest,
  type AvatarProviderDescriptor,
} from "../../services/presence/src/avatar-provider.js";

const tenantId = "tenant_018f6b2e-7c00-7001-8000-000000000001" as never;
const characterId = "character_018f6b2e-7c00-7002-8000-000000000002" as never;
const characterVersionId =
  "character-version_018f6b2e-7c00-7003-8000-000000000003" as never;
const now = "2026-10-06T11:20:00.000Z" as never;

function request(
  overrides: Partial<AvatarPresentationRequest> = {},
): AvatarPresentationRequest {
  return {
    tenantId,
    characterId,
    characterVersionId,
    appearanceReference: {
      system: "masanawa-assets",
      namespace: "character-avatar",
      value: "asset/avatar-001",
      mediaType: "model/gltf-binary",
      observedAt: "2026-10-06T10:00:00.000Z" as never,
    },
    preferredRendererKinds: ["vrm", "static-image"],
    allowAudioOnlyFallback: true,
    now,
    ...overrides,
  };
}

function provider(
  overrides: Partial<AvatarProviderDescriptor> = {},
): AvatarProviderDescriptor {
  return {
    providerKey: "renderer-vrm-primary",
    ready: true,
    rendererKinds: ["vrm"],
    acceptedMediaTypes: ["model/gltf-binary"],
    observedAt: "2026-10-06T11:19:00.000Z" as never,
    reason: null,
    ...overrides,
  };
}

describe("Task 123 renderer-neutral AvatarProvider", () => {
  it("selects the user's preferred compatible renderer from ready providers", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [
        provider({
          providerKey: "renderer-static",
          rendererKinds: ["static-image"],
          acceptedMediaTypes: ["model/gltf-binary"],
        }),
        provider(),
      ],
    });

    expect(plan).toMatchObject({
      mode: "avatar",
      providerKey: "renderer-vrm-primary",
      rendererKind: "vrm",
      tenantId,
      characterId,
      characterVersionId,
    });
  });

  it("uses deterministic provider ordering when several providers support the same renderer", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [
        provider({ providerKey: "renderer-z" }),
        provider({ providerKey: "renderer-a" }),
      ],
    });

    expect(plan.mode).toBe("avatar");
    if (plan.mode === "avatar") {
      expect(plan.providerKey).toBe("renderer-a");
    }
  });

  it("does not select a renderer whose media capabilities do not match the appearance reference", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [
        provider({
          providerKey: "renderer-vrm-wrong-media",
          rendererKinds: ["vrm"],
          acceptedMediaTypes: ["image/png"],
        }),
        provider({
          providerKey: "renderer-static-compatible",
          rendererKinds: ["static-image"],
          acceptedMediaTypes: ["model/gltf-binary"],
        }),
      ],
    });

    expect(plan).toMatchObject({
      mode: "avatar",
      providerKey: "renderer-static-compatible",
      rendererKind: "static-image",
    });
  });

  it("degrades to audio-only when no compatible renderer is ready", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [
        provider({
          ready: false,
          reason: "renderer offline",
        }),
      ],
    });

    expect(plan).toEqual({
      mode: "audio-only",
      providerKey: null,
      rendererKind: null,
      tenantId,
      characterId,
      characterVersionId,
      appearanceReference: null,
      reason: "no-compatible-renderer",
    });
  });

  it("fails instead of silently degrading when audio-only fallback is not allowed", () => {
    expect(() =>
      planAvatarPresentation({
        request: request({ allowAudioOnlyFallback: false }),
        providers: [provider({ ready: false, reason: "offline" })],
      }),
    ).toThrow("No compatible ready avatar renderer");
  });

  it("rejects an expired appearance reference before provider selection", () => {
    expect(() =>
      planAvatarPresentation({
        request: request({
          appearanceReference: {
            system: "masanawa-assets",
            namespace: "character-avatar",
            value: "asset/avatar-expired",
            mediaType: "model/gltf-binary",
            observedAt: "2026-10-01T10:00:00.000Z" as never,
            expiresAt: "2026-10-06T11:19:59.000Z" as never,
          },
        }),
        providers: [provider()],
      }),
    ).toThrow("Appearance reference expired");
  });

  it("accepts only a lease for the exact selected CharacterVersion, provider and appearance reference", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [provider()],
    });
    if (plan.mode !== "avatar") throw new Error("Expected avatar plan");

    const lease = assertAvatarLeaseMatchesPlan({
      plan,
      now,
      lease: {
        leaseId: "avatar-lease-001",
        providerKey: plan.providerKey,
        rendererKind: plan.rendererKind,
        tenantId,
        characterId,
        characterVersionId,
        appearanceReference: plan.appearanceReference,
        openedAt: "2026-10-06T11:19:30.000Z" as never,
        expiresAt: "2026-10-06T11:30:00.000Z" as never,
      },
    });

    expect(lease.characterVersionId).toBe(characterVersionId);
    expect(lease.appearanceReference.value).toBe("asset/avatar-001");
  });

  it("rejects provider, CharacterVersion and appearance substitutions in returned leases", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [provider()],
    });
    if (plan.mode !== "avatar") throw new Error("Expected avatar plan");

    const baseLease = {
      leaseId: "avatar-lease-001",
      providerKey: plan.providerKey,
      rendererKind: plan.rendererKind,
      tenantId,
      characterId,
      characterVersionId,
      appearanceReference: plan.appearanceReference,
      openedAt: "2026-10-06T11:19:30.000Z" as never,
      expiresAt: "2026-10-06T11:30:00.000Z" as never,
    };

    expect(() =>
      assertAvatarLeaseMatchesPlan({
        plan,
        now,
        lease: { ...baseLease, providerKey: "renderer-other" },
      }),
    ).toThrow("selected provider/renderer");

    expect(() =>
      assertAvatarLeaseMatchesPlan({
        plan,
        now,
        lease: {
          ...baseLease,
          characterVersionId:
            "character-version_018f6b2e-7c00-7999-8000-000000000999" as never,
        },
      }),
    ).toThrow("crossed Character presentation scope");

    expect(() =>
      assertAvatarLeaseMatchesPlan({
        plan,
        now,
        lease: {
          ...baseLease,
          appearanceReference: {
            ...plan.appearanceReference,
            value: "asset/other-avatar",
          },
        },
      }),
    ).toThrow("changed the selected appearance reference");
  });

  it("rejects already-expired presentation leases", () => {
    const plan = planAvatarPresentation({
      request: request(),
      providers: [provider()],
    });
    if (plan.mode !== "avatar") throw new Error("Expected avatar plan");

    expect(() =>
      assertAvatarLeaseMatchesPlan({
        plan,
        now,
        lease: {
          leaseId: "avatar-lease-expired",
          providerKey: plan.providerKey,
          rendererKind: plan.rendererKind,
          tenantId,
          characterId,
          characterVersionId,
          appearanceReference: plan.appearanceReference,
          openedAt: "2026-10-06T11:00:00.000Z" as never,
          expiresAt: "2026-10-06T11:19:59.000Z" as never,
        },
      }),
    ).toThrow("not currently usable");
  });
});
