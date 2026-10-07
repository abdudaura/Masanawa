import { createCanonicalId, parseCanonicalId, type RequestId } from "@masanawa/contracts";
import { CloneSetupError, type CloneSetupScope } from "@masanawa/identity";
import type { CreatorAuthorizer } from "./creator_clone.js";
import type { CloneOnboardingService, CloneOnboardingView } from "./clone_onboarding.js";

type Command = "save" | "preview" | "edit" | "confirm" | "cancel" | "support";
export interface CloneOnboardingShellAction {
  readonly documentId: string;
  readonly revision: number;
  readonly nodeId: string;
  readonly actionId: string;
  readonly token: string;
  readonly values: Readonly<Record<string, string>>;
}
/** Server-only record held by the existing authenticated Shell dispatcher. */
export interface CloneOnboardingShellBinding extends CloneSetupScope {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly setupRevision: number | null;
  readonly setupState: string | null;
  readonly nodeId: string;
  readonly command: Command;
  readonly expiresAt: string;
  readonly confirmationRequestId: RequestId | null;
  readonly confirmationPreviewRevision: number | null;
  readonly supportCharacterId: string | null;
}
/** Uses the owner's durable opaque-token custody; never accept client bindings. */
export interface CloneOnboardingShellBindings {
  issue(binding: CloneOnboardingShellBinding): Promise<string>;
  resolve(token: string): Promise<CloneOnboardingShellBinding | null>;
}
interface Node {
  readonly type: string;
  readonly id?: string;
  readonly text?: string;
  readonly subtitle?: string;
  readonly required?: boolean;
  readonly tone?: "info" | "success" | "warning";
  readonly action?: string;
  readonly token?: string;
  readonly children?: readonly Node[];
}
export interface CloneOnboardingShellDocument {
  readonly version: 1;
  readonly id: string;
  readonly revision: number;
  readonly fallback: string;
  readonly expiresAt: string;
  readonly nodes: readonly Node[];
}
const idPattern = /^[A-Za-z0-9._:-]{1,128}$/u;
const profileFields = ["displayName", "languages", "biography", "personality", "expertise"] as const;
const invalid = (): never => { throw new CloneSetupError("invalid"); };
function scopeEqual(a: CloneSetupScope, b: CloneSetupScope): boolean {
  return a.tenantId === b.tenantId && a.userId === b.userId;
}
function freezeNode(node: Node): Node {
  return Object.freeze({ ...node, ...(node.children ? { children: Object.freeze(node.children.map(freezeNode)) } : {}) });
}
function profilePatch(values: Readonly<Record<string, string>>): Record<string, unknown> {
  if (Object.keys(values).some(key => !(profileFields as readonly string[]).includes(key))) return invalid();
  const patch: Record<string, unknown> = {};
  for (const field of profileFields) {
    const value = values[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 512) return invalid();
    if (!value.trim()) continue; // The v1 renderer cannot prefill inputs. Blank retains saved fields.
    patch[field] = field === "languages" || field === "personality" || field === "expertise"
      ? value.split(/[,\n]/u).map(item => item.trim()) : value.trim();
  }
  if (Object.keys(patch).length === 0) return invalid();
  return patch;
}

/** Presentation + action bridge only. Existing Gateway owns registration/session/turn custody. */
export function createCloneOnboardingShell(input: {
  readonly service: CloneOnboardingService;
  readonly authorizer: CreatorAuthorizer;
  readonly bindings: CloneOnboardingShellBindings;
  readonly now?: () => number;
}) {
  const now = input.now ?? Date.now;
  type Request = { readonly authorizationHeader: string | undefined };
  type Presentation = { readonly documentId: string; readonly revision: number; readonly mode?: "profile" | "edit" | "support" };
  async function render(request: Request, options: Presentation): Promise<CloneOnboardingShellDocument> {
    if (!idPattern.test(options.documentId) || !Number.isSafeInteger(options.revision) || options.revision < 0) return invalid();
    const scope = await input.authorizer.authorize({ ...request, capability: "creator.clone.write" });
    const view = await input.service.read(request);
    if (view.setup && !scopeEqual(scope, view.setup)) return invalid();
    const setup = view.setup;
    const expiresAt = new Date(now() + 10 * 60_000).toISOString();
    // Issue once per projection, and persist it before sending this document.
    const confirmationRequestId = setup?.confirmationRequestId ?? (setup?.state === "preview" ? createCanonicalId("request") : null);
    const confirmationPreviewRevision = setup?.confirmationPreviewRevision ?? (setup?.state === "preview" ? setup.revision : null);
    async function button(command: Command, label: string, supportCharacterId: string | null = null): Promise<Node> {
      const nodeId = supportCharacterId === null ? command : `support-${supportCharacterId}`;
      const token = await input.bindings.issue(Object.freeze({ ...scope, documentId: options.documentId, documentRevision: options.revision,
        setupRevision: setup?.revision ?? null, setupState: setup?.state ?? null, nodeId, command, expiresAt,
        confirmationRequestId: command === "confirm" ? confirmationRequestId : null,
        confirmationPreviewRevision: command === "confirm" ? confirmationPreviewRevision : null, supportCharacterId }));
      if (typeof token !== "string" || token.length < 8 || token.length > 2048) return invalid();
      return { type: "button", id: nodeId, text: label, action: `clone.onboarding.${command}`, token };
    }
    const nodes: Node[] = [{ type: "heading", text: options.mode === "support" ? "Your support agent" : "Your personal clone" }];
    if (options.mode === "support") {
      nodes.push({ type: "text", text: "Choose who helps you use Masanawa." });
      if (view.supportAgents.length > 16) return invalid();
      const buttons: Node[] = [];
      for (const agent of view.supportAgents) {
        parseCanonicalId("character", agent.characterId);
        buttons.push(await button("support", `${agent.displayName.slice(0, 120)}${agent.characterId === view.defaultSupportAgentId ? " (selected)" : ""}`, agent.characterId));
      }
      nodes.push(buttons.length ? { type: "options", children: buttons } : { type: "notice", tone: "warning", text: "Support agents are not available yet. Please try again later." });
    } else {
      nodes.push({ type: "text", text: view.prompt });
      if (setup && setup.state !== "cancelled") {
        nodes.push({ type: "card", children: [
          { type: "text", text: `Name: ${setup.profile.displayName ?? "Not chosen"}` },
          { type: "text", text: `Languages: ${setup.profile.languages.join(", ") || "Not chosen"}` },
          { type: "text", text: setup.profile.biography },
          { type: "text", text: `Style: ${setup.profile.personality.join(", ")}` },
          { type: "text", text: `Interests: ${setup.profile.expertise.join(", ")}` },
        ] });
      }
      const reviewable = setup?.state === "editing" && !!setup.profile.displayName && setup.profile.languages.length > 0 && options.mode !== "edit";
      const editable = !setup || (setup.state === "editing" && !reviewable) || setup.state === "cancelled" || (setup.state === "preview" && options.mode === "edit");
      if (editable) {
        nodes.push({ type: "notice", tone: "info", text: "Enter only what you want to change. Separate languages, style and interests with commas. Blank fields keep your saved choices." });
        for (const [field, label] of [["displayName", "Name"], ["languages", "Languages"], ["biography", "About your clone"], ["personality", "Communication style"], ["expertise", "Interests"]] as const) {
          nodes.push({ type: "input", id: field, text: label, required: false });
        }
        // Forms have one action. Preview/cancel live in a separate document without unsaved values.
        nodes.push(await button("save", "Save profile"));
      } else if (setup?.state === "preview") {
        nodes.push({ type: "options", children: [await button("confirm", "Confirm and create"), await button("edit", "Edit profile"), await button("cancel", "Cancel setup")] });
      } else if (setup?.state === "confirmed") {
        nodes.push({ type: "notice", tone: "warning", text: "Your confirmation is saved. Resume this setup to finish safely." }, await button("confirm", "Resume setup"));
      } else if (setup?.state === "ready") {
        nodes.push({ type: "notice", tone: "success", text: `${setup.result?.displayName ?? "Your clone"} has been created. Available capabilities still require a conversation check.` });
      }
      // A complete editing draft can be reviewed through a distinct read-only action document.
      if (reviewable) {
        nodes.push({ type: "options", children: [await button("preview", "Review profile"), await button("edit", "Change profile"), await button("cancel", "Cancel setup")] });
      }
    }
    const fallback = options.mode === "support" ? "Choose a support agent in Settings." : view.prompt;
    let textBudget = 24_000 - fallback.length;
    let nodeBudget = 100;
    const ids = new Set<string>();
    function check(node: Node, depth: number): void {
      if (--nodeBudget < 0 || depth > 6) return invalid();
      if (node.id) { if (ids.has(node.id)) return invalid(); ids.add(node.id); }
      for (const [key, value] of Object.entries(node)) {
        if (typeof value !== "string") continue;
        const maximum = key === "text" ? 4000 : key === "token" ? 2048 : key === "subtitle" ? 1000 : 128;
        if (value.length > maximum || (textBudget -= value.length) < 0) return invalid();
      }
      for (const child of node.children ?? []) check(child, depth + 1);
    }
    nodes.forEach(node => check(node, 0));
    return Object.freeze({ version: 1 as const, id: options.documentId, revision: options.revision, expiresAt, fallback, nodes: Object.freeze(nodes.map(freezeNode)) });
  }
  async function execute(request: Request & { readonly action: CloneOnboardingShellAction }): Promise<{ readonly view: CloneOnboardingView; readonly mode: "profile" | "edit" | "support" }> {
    const { action } = request;
    if (typeof action.token !== "string" || action.token.length < 8 || action.token.length > 2048 || !action.values || typeof action.values !== "object" || Array.isArray(action.values)) return invalid();
    const binding = await input.bindings.resolve(action.token);
    if (!binding || !Number.isFinite(Date.parse(binding.expiresAt)) || now() >= Date.parse(binding.expiresAt)
      || action.documentId !== binding.documentId || action.revision !== binding.documentRevision || action.nodeId !== binding.nodeId
      || action.actionId !== `clone.onboarding.${binding.command}`) return invalid();
    const scope = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader, capability: "creator.clone.write" });
    if (!scopeEqual(scope, binding)) return invalid();
    const auth = { authorizationHeader: request.authorizationHeader };
    const current = await input.service.read(auth);
    const exactConfirmationReplay = binding.command === "confirm" && (current.setup?.state === "confirmed" || current.setup?.state === "ready")
      && current.setup.confirmationRequestId === binding.confirmationRequestId && current.setup.confirmationPreviewRevision === binding.confirmationPreviewRevision;
    if (!exactConfirmationReplay && (binding.setupRevision !== (current.setup?.revision ?? null) || binding.setupState !== (current.setup?.state ?? null))) throw new CloneSetupError("conflict");
    if (binding.command !== "save" && Object.keys(action.values).length) return invalid();
    let view: CloneOnboardingView;
    switch (binding.command) {
      case "save": view = await input.service.save({ ...auth, expectedRevision: binding.setupRevision, profile: profilePatch(action.values) }); break;
      case "preview": if (binding.setupRevision === null) return invalid(); view = await input.service.preview({ ...auth, expectedRevision: binding.setupRevision }); break;
      case "edit": if (current.setup?.state === "confirmed" || current.setup?.state === "ready") return invalid(); view = current; break;
      case "cancel": if (binding.setupRevision === null) return invalid(); view = await input.service.cancel({ ...auth, expectedRevision: binding.setupRevision }); break;
      case "confirm": if (!binding.confirmationRequestId || binding.confirmationPreviewRevision === null) return invalid(); view = await input.service.confirm({ ...auth, requestId: binding.confirmationRequestId, expectedPreviewRevision: binding.confirmationPreviewRevision }); break;
      case "support": if (!binding.supportCharacterId) return invalid(); view = await input.service.selectSupport({ ...auth, characterId: binding.supportCharacterId }); break;
      default: return invalid();
    }
    return Object.freeze({ view, mode: binding.command === "edit" ? "edit" : binding.command === "support" ? "support" : "profile" });
  }
  return Object.freeze({ render, execute });
}
