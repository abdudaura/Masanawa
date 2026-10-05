export type LaunchIdentityTier =
  | "unverified"
  | "basic"
  | "verified";

export interface TwinEconomyLaunchEligibility {
  readonly userId: string;
  readonly ageDeclaredAdult: boolean;
  readonly identityTier: LaunchIdentityTier;
  readonly accountRestricted: boolean;
  readonly canReceiveEarnings: boolean;
  readonly canWithdrawEarnings: boolean;
  readonly canOfferOwnerAccess: boolean;
}

export interface TwinEconomyLaunchDecision {
  readonly allowed: boolean;
  readonly canReceiveEarnings: boolean;
  readonly canWithdrawEarnings: boolean;
  readonly canOfferOwnerAccess: boolean;
  readonly reason:
    | "allowed"
    | "account-restricted"
    | "adult-declaration-required"
    | "identity-required";
}

export function evaluateTwinEconomyLaunchEligibility(
  input: TwinEconomyLaunchEligibility,
): TwinEconomyLaunchDecision {
  if (input.accountRestricted) {
    return {
      allowed: false,
      canReceiveEarnings: false,
      canWithdrawEarnings: false,
      canOfferOwnerAccess: false,
      reason: "account-restricted",
    };
  }

  if (!input.ageDeclaredAdult) {
    return {
      allowed: true,
      canReceiveEarnings: input.canReceiveEarnings,
      canWithdrawEarnings: false,
      canOfferOwnerAccess: false,
      reason: "adult-declaration-required",
    };
  }

  if (input.identityTier === "unverified") {
    return {
      allowed: true,
      canReceiveEarnings: input.canReceiveEarnings,
      canWithdrawEarnings: false,
      canOfferOwnerAccess: false,
      reason: "identity-required",
    };
  }

  return {
    allowed: true,
    canReceiveEarnings: input.canReceiveEarnings,
    canWithdrawEarnings: input.canWithdrawEarnings,
    canOfferOwnerAccess: input.canOfferOwnerAccess,
    reason: "allowed",
  };
}
