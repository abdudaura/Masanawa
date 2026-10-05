import { CustomerAuthError } from "./customer_auth.js";
import { cancelCloneSetup, completeCloneSetup, confirmCloneSetup, previewCloneSetup, reviseCloneSetup, CloneSetupError, type CloneSetup, type CloneSetupRepository, type PersonalCloneProvisioningRepository } from "@masanawa/identity";
import { parseCanonicalId, PlatformError } from "@masanawa/contracts";
import type { CharacterSkillAssignmentRepository } from "@masanawa/agents";
import { evaluateSkillEligibility, restoreSkillRegistry, type SkillRepository, type SkillGuideRepository, type SkillDistributionRepository } from "@masanawa/skills";
import type { AgentDirectoryService, MobileAgentDirectoryEntry } from "./agent_directory.js";
import type { CreatorAuthorizer, CreatorCloneService } from "./creator_clone.js";

type Authenticated = { readonly authorizationHeader: string | undefined };
export interface CloneCoreProvisioner {
  ensure(request: Authenticated & { readonly characterId: string }): Promise<void>;
}
/** Assign configured, currently eligible automatic Core versions; never seed or certify them. */
export function createAutomaticCloneCoreProvisioner(input: {
  readonly authorizer: CreatorAuthorizer;
  readonly personalClones: PersonalCloneProvisioningRepository;
  readonly assignments: CharacterSkillAssignmentRepository;
  readonly skills: SkillRepository;
  readonly guides: SkillGuideRepository;
  readonly distribution: SkillDistributionRepository;
}): CloneCoreProvisioner {
  return Object.freeze<CloneCoreProvisioner>({
    async ensure(request) {
      const scope = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader, capability: "creator.skills.write" });
      const characterId = parseCanonicalId("character", request.characterId);
      const owner = await input.personalClones.readPersonalClone(scope);
      if (owner?.characterId !== characterId) throw new CloneSetupError("invalid");
      const profiles = (await input.distribution.listForAudience("personal-clone")).filter(profile => profile.installMode === "automatic" && profile.audiences.includes("personal-clone"));
      const registry = restoreSkillRegistry(await input.skills.readSnapshot());
      // Core Teaching is a required product capability, not an optional paid enrollment.
      if (!profiles.some(profile => registry.getVersion(profile.skillVersionId)?.key === "core.teaching")) throw new CloneSetupError("not-ready");
      const guides = await input.guides.readGuides(profiles.map(profile => profile.skillVersionId));
      const guideIds = new Set(guides.map(guide => guide.skillVersionId));
      for (const profile of profiles) {
        const eligibility = evaluateSkillEligibility(registry, profile.skillVersionId);
        if (!eligibility.eligible || !eligibility.advertisable || !guideIds.has(profile.skillVersionId)) throw new CloneSetupError("not-ready");
      }
      const current = await input.assignments.readForCharacter({ tenantId: scope.tenantId, characterId });
      const selected = new Set(current?.skillVersionIds ?? []);
      for (const profile of profiles) selected.add(profile.skillVersionId);
      if (selected.size > 64) throw new CloneSetupError("not-ready");
      if (current && selected.size === current.skillVersionIds.length) return;
      await input.assignments.put({ expectedRevision: current?.revision ?? null, assignment: {
        schemaVersion: 1, tenantId: scope.tenantId, characterId, skillVersionIds: [...selected].sort(), revision: current?.revision ?? 1,
      } });
    },
  });
}
export interface CloneOnboardingView {
  readonly setup: CloneSetup | null;
  readonly supportAgents: readonly MobileAgentDirectoryEntry[];
  readonly defaultSupportAgentId: string | null;
  readonly nextStep: "name" | "languages" | "preview" | "confirm" | "recover" | "open-clone";
  readonly prompt: string;
  readonly runtimeReadiness: "not-verified";
}
export interface CloneOnboardingService {
  read(request: Authenticated): Promise<CloneOnboardingView>;
  save(request: Authenticated & { readonly expectedRevision: number | null; readonly profile: unknown }): Promise<CloneOnboardingView>;
  preview(request: Authenticated & { readonly expectedRevision: number }): Promise<CloneOnboardingView>;
  confirm(request: Authenticated & { readonly expectedPreviewRevision: number; readonly requestId: string }): Promise<CloneOnboardingView>;
  cancel(request: Authenticated & { readonly expectedRevision: number }): Promise<CloneOnboardingView>;
  selectSupport(request: Authenticated & { readonly characterId: string }): Promise<CloneOnboardingView>;
}
export function projectCloneOnboarding(setup: CloneSetup | null, agents: readonly MobileAgentDirectoryEntry[]): CloneOnboardingView {
  const supportAgents = Object.freeze(agents.filter(agent => agent.supportAgent).map(agent => Object.freeze({ ...agent })));
  const selected = supportAgents.filter(agent => agent.defaultPlatformAgent);
  // Do not guess an identity if provisioning/preferences are missing or inconsistent.
  const defaultSupportAgentId = selected.length === 1 ? selected[0]!.characterId : null;
  let nextStep: CloneOnboardingView["nextStep"] = "name";
  let prompt = "What name would you like your personal clone to use?";
  if (setup?.state === "ready") { nextStep = "open-clone"; prompt = "Your clone profile is created. Open the conversation to check its available capabilities."; }
  else if (setup?.state === "confirmed") { nextStep = "recover"; prompt = "Your profile is confirmed. Resume the same request to finish setup."; }
  else if (setup?.state === "preview") { nextStep = "confirm"; prompt = "Review this profile. Confirm to create your clone, or edit it first."; }
  else if (setup?.state !== "cancelled" && setup?.profile.displayName) {
    if (setup.profile.languages.length === 0) { nextStep = "languages"; prompt = "Which languages should your clone use?"; }
    else { nextStep = "preview"; prompt = "Your profile is ready to review. You can also add interests or change its communication style."; }
  }
  return Object.freeze({ setup, supportAgents, defaultSupportAgentId, nextStep, prompt, runtimeReadiness: "not-verified" });
}
export function createCloneOnboardingService(input: {
  readonly authorizer: CreatorAuthorizer;
  readonly setups: CloneSetupRepository;
  readonly clones: CreatorCloneService;
  readonly directory: AgentDirectoryService;
  readonly core: CloneCoreProvisioner;
}): CloneOnboardingService {
  async function authorize(authorizationHeader: string | undefined) {
    try { return await input.authorizer.authorize({ authorizationHeader, capability: "creator.clone.write" }); }
    catch (error) {
      const status = error instanceof CustomerAuthError ? error.statusCode : null;
      const category = error instanceof PlatformError ? error.category : null;
      const authentication = status === 401 || category === "authentication";
      const unavailable = status === 503 || category === "unavailable";
      throw new PlatformError({ code: unavailable ? "clone.setup.unavailable" : "clone.setup.denied",
        category: unavailable ? "unavailable" : authentication ? "authentication" : "authorization",
        message: unavailable ? "Setup authentication is temporarily unavailable" : "Clone setup access denied", retryable: unavailable });
    }
  }
  async function view(request: Authenticated, setup: CloneSetup | null): Promise<CloneOnboardingView> {
    // Directory owns configured Gwani/Gwana identity, defaults and voice presentation.
    return projectCloneOnboarding(setup, await input.directory.list(request));
  }
  return Object.freeze<CloneOnboardingService>({
    async read(request) {
      const scope = await authorize(request.authorizationHeader);
      return view(request, await input.setups.read(scope));
    },
    async save(request) {
      const scope = await authorize(request.authorizationHeader);
      const setup = await input.setups.mutate(scope, current => reviseCloneSetup(scope, current, request.expectedRevision, request.profile));
      return view(request, setup);
    },
    async preview(request) {
      const scope = await authorize(request.authorizationHeader);
      const setup = await input.setups.mutate(scope, current => previewCloneSetup(scope, current, request.expectedRevision));
      return view(request, setup);
    },
    async confirm(request) {
      const scope = await authorize(request.authorizationHeader);
      const setup = await input.setups.mutate(scope, current => confirmCloneSetup(scope, current, request.expectedPreviewRevision, request.requestId));
      if (setup.state === "ready") return view(request, setup);
      if (!setup.profile.displayName) throw new CloneSetupError("not-ready");
      // Confirmation is durable BEFORE provisioning. A crash cannot reopen the
      // profile for edits. Retry uses the existing canonical get-or-create path.
      const result = await input.clones.create({
        authorizationHeader: request.authorizationHeader,
        displayName: setup.profile.displayName,
        biography: setup.profile.biography,
        languages: setup.profile.languages,
        personality: setup.profile.personality,
        expertise: setup.profile.expertise,
      });
      // Empty or unqualified automatic capability bundles cannot finish onboarding.
      // The durable confirmed profile remains recoverable while owners provision Core.
      await input.core.ensure({ authorizationHeader: request.authorizationHeader, characterId: result.characterId });
      // Revalidate the user capability after the independent provisioning step.
      const currentScope = await authorize(request.authorizationHeader);
      if (currentScope.tenantId !== scope.tenantId || currentScope.userId !== scope.userId) throw new CloneSetupError("invalid");
      const ready = await input.setups.mutate(scope, current => completeCloneSetup(scope, current, request.requestId, result));
      return view(request, ready);
    },
    async cancel(request) {
      const scope = await authorize(request.authorizationHeader);
      return view(request, await input.setups.mutate(scope, current => cancelCloneSetup(scope, current, request.expectedRevision)));
    },
    async selectSupport(request) {
      const scope = await authorize(request.authorizationHeader);
      let id;
      try { id = parseCanonicalId("character", request.characterId); }
      catch { throw new CloneSetupError("invalid"); }
      const agents = await input.directory.list(request);
      if (!agents.some(agent => agent.supportAgent && agent.characterId === id)) throw new CloneSetupError("invalid");
      await input.directory.setDefaultPlatformAgent({ authorizationHeader: request.authorizationHeader, characterId: id });
      return view(request, await input.setups.read(scope));
    },
  });
}
