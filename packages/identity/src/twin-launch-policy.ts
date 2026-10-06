export type TwinOwnerAgeBand = "adult" | "minor" | "unknown";

export type TwinOwnerIdentityAssurance =
  | "verified"
  | "unverified"
  | "unknown";

export type TwinImpersonationReviewState =
  | "clear"
  | "reported"
  | "confirmed";

export type TwinPublicAction =
  | "publish-profile"
  | "discover-profile"
  | "open-public-chat";

export type TwinLaunchIdentityDenialReason =
  | "profile-not-discoverable"
  | "owner-identity-unverified"
  | "owner-age-unknown"
  | "minor-public-presence-disabled"
  | "impersonation-under-review"
  | "impersonation-confirmed";

export interface TwinLaunchIdentityPolicy {
  /**
   * Public discovery/publishing normally requires a verified owner identity.
   * This is intentionally configurable policy rather than a hard-coded provider rule.
   */
  readonly requireVerifiedOwnerForPublicPresence: boolean;

  /**
   * Launch default is fail-closed for unknown age. Operators may relax only through
   * an explicit policy revision after legal/product review.
   */
  readonly allowUnknownAgePublicPresence: boolean;

  /**
   * Launch default is fail-closed for minor-owned public Twins. This flag is a policy
   * input, not an assertion about any jurisdiction's legal age.
   */
  readonly allowMinorPublicPresence: boolean;

  /**
   * A submitted impersonation report may temporarily remove a Twin from public
   * presence while human/operator review is pending. A confirmed impersonation finding
   * is always denied by this module.
   */
  readonly allowPublicPresenceWhileImpersonationReported: boolean;
}

export interface TwinLaunchIdentityContext {
  readonly ownerAgeBand: TwinOwnerAgeBand;
  readonly ownerIdentityAssurance: TwinOwnerIdentityAssurance;
  readonly impersonationReviewState: TwinImpersonationReviewState;
  readonly profileDiscoverable: boolean;
}

export interface TwinLaunchIdentityDecision {
  readonly allowed: boolean;
  readonly action: TwinPublicAction;
  readonly reasons: readonly TwinLaunchIdentityDenialReason[];
}

export const DEFAULT_TWIN_LAUNCH_IDENTITY_POLICY: TwinLaunchIdentityPolicy =
  Object.freeze({
    requireVerifiedOwnerForPublicPresence: true,
    allowUnknownAgePublicPresence: false,
    allowMinorPublicPresence: false,
    allowPublicPresenceWhileImpersonationReported: false,
  });

function validateContext(context: TwinLaunchIdentityContext): void {
  if (
    context.ownerAgeBand !== "adult" &&
    context.ownerAgeBand !== "minor" &&
    context.ownerAgeBand !== "unknown"
  ) {
    throw new TypeError("ownerAgeBand is invalid");
  }

  if (
    context.ownerIdentityAssurance !== "verified" &&
    context.ownerIdentityAssurance !== "unverified" &&
    context.ownerIdentityAssurance !== "unknown"
  ) {
    throw new TypeError("ownerIdentityAssurance is invalid");
  }

  if (
    context.impersonationReviewState !== "clear" &&
    context.impersonationReviewState !== "reported" &&
    context.impersonationReviewState !== "confirmed"
  ) {
    throw new TypeError("impersonationReviewState is invalid");
  }

  if (typeof context.profileDiscoverable !== "boolean") {
    throw new TypeError("profileDiscoverable must be boolean");
  }
}

function validatePolicy(policy: TwinLaunchIdentityPolicy): void {
  for (const [name, value] of Object.entries(policy)) {
    if (typeof value !== "boolean") {
      throw new TypeError(`${name} must be boolean`);
    }
  }
}

function appliesPublicPresenceIdentityGate(action: TwinPublicAction): boolean {
  return action === "publish-profile" || action === "discover-profile";
}

export function evaluateTwinLaunchIdentityGate(input: {
  readonly action: TwinPublicAction;
  readonly context: TwinLaunchIdentityContext;
  readonly policy?: TwinLaunchIdentityPolicy;
}): TwinLaunchIdentityDecision {
  const policy = input.policy ?? DEFAULT_TWIN_LAUNCH_IDENTITY_POLICY;
  validateContext(input.context);
  validatePolicy(policy);

  if (
    input.action !== "publish-profile" &&
    input.action !== "discover-profile" &&
    input.action !== "open-public-chat"
  ) {
    throw new TypeError("action is invalid");
  }

  const reasons: TwinLaunchIdentityDenialReason[] = [];

  if (input.context.impersonationReviewState === "confirmed") {
    reasons.push("impersonation-confirmed");
  } else if (
    input.context.impersonationReviewState === "reported" &&
    !policy.allowPublicPresenceWhileImpersonationReported
  ) {
    reasons.push("impersonation-under-review");
  }

  if (appliesPublicPresenceIdentityGate(input.action)) {
    if (
      policy.requireVerifiedOwnerForPublicPresence &&
      input.context.ownerIdentityAssurance !== "verified"
    ) {
      reasons.push("owner-identity-unverified");
    }

    if (
      input.context.ownerAgeBand === "unknown" &&
      !policy.allowUnknownAgePublicPresence
    ) {
      reasons.push("owner-age-unknown");
    }

    if (
      input.context.ownerAgeBand === "minor" &&
      !policy.allowMinorPublicPresence
    ) {
      reasons.push("minor-public-presence-disabled");
    }
  }

  if (
    input.action === "discover-profile" &&
    !input.context.profileDiscoverable
  ) {
    reasons.push("profile-not-discoverable");
  }

  return Object.freeze({
    allowed: reasons.length === 0,
    action: input.action,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function assertTwinLaunchIdentityAllowed(input: {
  readonly action: TwinPublicAction;
  readonly context: TwinLaunchIdentityContext;
  readonly policy?: TwinLaunchIdentityPolicy;
}): void {
  const decision = evaluateTwinLaunchIdentityGate(input);
  if (!decision.allowed) {
    throw new Error(
      `Twin public action denied: ${decision.reasons.join(", ")}`,
    );
  }
}
