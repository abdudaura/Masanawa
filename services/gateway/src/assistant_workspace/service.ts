import {
  PlatformError,
  parseCanonicalId,
  type CorrelationId,
  type RequestId,
} from "@masanawa/contracts";
import type { AgentDirectoryService, MobileAgentDirectoryEntry } from "../agent_directory.js";
import type { AgentConversationService } from "../agent_conversation_contract.js";
import type { AgentShellService } from "../agent_shell_contract.js";
import type { MobileHistoryMessage } from "@masanawa/agents";

export type AssistantRole = "gwani" | "gwana";

export interface AssistantRoleView {
  readonly role: AssistantRole;
  readonly characterId: string;
  readonly displayName: string;
  readonly voiceName: string | null;
  readonly selected: boolean;
}

export interface AssistantWorkspaceMessage {
  readonly role: AssistantRole;
  readonly characterId: string;
  readonly message: MobileHistoryMessage;
}

export interface AssistantWorkspaceService {
  snapshot(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<{
    readonly activeRole: AssistantRole;
    readonly roles: readonly AssistantRoleView[];
    readonly messages: readonly AssistantWorkspaceMessage[];
  }>;
  select(input: {
    readonly authorizationHeader: string | undefined;
    readonly role: AssistantRole;
  }): Promise<{ readonly activeRole: AssistantRole }>;
  open(input: {
    readonly authorizationHeader: string | undefined;
    readonly role: AssistantRole;
  }): Promise<{ readonly characterSessionId: string; readonly role: AssistantRole }>;
  turn(input: {
    readonly authorizationHeader: string | undefined;
    readonly role: AssistantRole;
    readonly characterSessionId: string;
    readonly requestId: RequestId;
    readonly correlationId: CorrelationId;
    readonly text: string;
  }): ReturnType<AgentConversationService["turn"]>;
  turnStatus(input: {
    readonly authorizationHeader: string | undefined;
    readonly role: AssistantRole;
    readonly requestId: RequestId;
  }): ReturnType<AgentShellService["turnStatus"]>;
}

function rejected(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

type Roles = Record<AssistantRole, MobileAgentDirectoryEntry>;

function roleOf(entry: MobileAgentDirectoryEntry): AssistantRole | null {
  if (!entry.supportAgent) return null;
  const name = entry.displayName.trim().toLowerCase();
  const voice = entry.voiceName?.trim().toLowerCase();
  const byName: AssistantRole | null =
    name === "gwani" || name === "gwana" ? name : null;
  const byVoice: AssistantRole | null =
    voice === "bodi" ? "gwani" : voice === "sulafat" ? "gwana" : null;

  // Both fields are authenticated directory metadata, but neither is a
  // canonical immutable role ID. Never silently prefer one when they disagree:
  // that could attribute a turn, pending status or private history to the
  // wrong assistant. F03 must eventually provide stable server role codes.
  if (byName && byVoice && byName !== byVoice) {
    throw rejected(
      "assistant.support_identity_conflict",
      "Support assistant identity is inconsistent. Please retry later.",
    );
  }
  return byName ?? byVoice;
}

function validateRoles(entries: readonly MobileAgentDirectoryEntry[]): {
  readonly roles: Roles;
  readonly activeRole: AssistantRole;
} {
  const byRole: Partial<Record<AssistantRole, MobileAgentDirectoryEntry>> = {};
  for (const entry of entries) {
    const role = roleOf(entry);
    if (role === null) {
      // A currently selected support identity that we cannot attribute to
      // Gwani or Gwana must not be silently replaced by the Gwani fallback.
      if (entry.supportAgent && entry.defaultPlatformAgent) {
        throw rejected(
          "assistant.selected_support_unrecognized",
          "Selected support assistant is unavailable in this workspace.",
        );
      }
      continue;
    }
    if (byRole[role]) {
      throw rejected(
        "assistant.ambiguous_support_identity",
        "The assistant directory needs administrator attention.",
      );
    }
    byRole[role] = entry;
  }
  if (!byRole.gwani || !byRole.gwana ||
      byRole.gwani.characterId === byRole.gwana.characterId) {
    throw rejected(
      "assistant.support_unavailable",
      "Both support assistants must be available for this account.",
    );
  }
  const active = (["gwani", "gwana"] as const).filter(
    role => byRole[role]!.defaultPlatformAgent,
  );
  if (active.length > 1) {
    throw rejected(
      "assistant.preference_ambiguous",
      "Assistant preference could not be verified.",
    );
  }
  return {
    roles: { gwani: byRole.gwani, gwana: byRole.gwana },
    activeRole: active[0] ?? "gwani",
  };
}

/**
 * Non-financial workspace API composed solely over the existing authenticated
 * directory, mobile shell and character-session authorities. History is a
 * unified projection, not a new transcript store or a shared model prompt.
 *
 * An actual durable cross-persona task registry/action authorization remains
 * required before C07 can ship; this adapter cannot grant that permission.
 */
export function createAssistantWorkspaceService(input: Readonly<{
  directory: AgentDirectoryService;
  shell: AgentShellService;
  conversations: AgentConversationService;
}>): AssistantWorkspaceService {
  async function roles(authorizationHeader: string | undefined) {
    // Canonical directory authenticates principal, filters tenant and visible
    // support identities. Never trust a role or character ID from the client.
    const entries = await input.directory.list({ authorizationHeader });
    return validateRoles(entries);
  }

  function roleId(raw: AssistantRole, authorized: Roles): string {
    if (raw !== "gwani" && raw !== "gwana") {
      throw rejected("assistant.role_invalid", "Invalid assistant role.");
    }
    return authorized[raw].characterId;
  }

  return Object.freeze<AssistantWorkspaceService>({
    async snapshot({ authorizationHeader, limit = 50 }) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw rejected("assistant.page_invalid", "Invalid assistant history page.");
      }
      const { roles: authorized, activeRole } = await roles(authorizationHeader);
      // Every history call reauthorizes the canonical Character relationship.
      // If either relationship is revoked, fail the entire snapshot rather
      // than mixing stale private data with an anonymous public projection.
      const perRole = await Promise.all(
        (["gwani", "gwana"] as const).map(async role => ({
          role,
          characterId: authorized[role].characterId,
          messages: await input.shell.history({
            authorizationHeader,
            characterId: authorized[role].characterId,
            limit,
          }),
        })),
      );
      const messages = perRole.flatMap(({ role, characterId, messages }) =>
        messages.map(message => Object.freeze({
          role,
          characterId,
          message,
        })),
      );
      messages.sort((left, right) => {
        const time = left.message.createdAt.localeCompare(right.message.createdAt);
        if (time !== 0) return time;
        const leftKey = left.characterId + ":" + left.message.key;
        const rightKey = right.characterId + ":" + right.message.key;
        return leftKey.localeCompare(rightKey);
      });
      const bounded = messages.slice(-limit);
      return Object.freeze({
        activeRole,
        roles: Object.freeze((["gwani", "gwana"] as const).map(role =>
          Object.freeze({
            role,
            characterId: authorized[role].characterId,
            displayName: authorized[role].displayName,
            voiceName: authorized[role].voiceName,
            selected: role === activeRole,
          }),
        )),
        messages: Object.freeze(bounded),
      });
    },

    async select({ authorizationHeader, role }) {
      const before = await roles(authorizationHeader);
      const characterId = roleId(role, before.roles);
      if (before.activeRole !== role) {
        await input.directory.setDefaultPlatformAgent({
          authorizationHeader,
          characterId,
        });
      }
      const after = await roles(authorizationHeader);
      if (after.activeRole !== role ||
          after.roles[role].characterId !== characterId ||
          !after.roles[role].defaultPlatformAgent) {
        throw rejected(
          "assistant.preference_not_confirmed",
          "The assistant switch could not be confirmed. Please retry.",
        );
      }
      return Object.freeze({ activeRole: role });
    },

    async open({ authorizationHeader, role }) {
      const resolved = await roles(authorizationHeader);
      const characterId = roleId(role, resolved.roles);
      if (resolved.activeRole !== role) {
        throw rejected("assistant.selection_changed", "Refresh your selected assistant.");
      }
      const result = await input.conversations.open({
        authorizationHeader, characterId,
      });
      return Object.freeze({
        characterSessionId: result.characterSessionId,
        role,
      });
    },

    async turn(request) {
      const resolved = await roles(request.authorizationHeader);
      const characterId = roleId(request.role, resolved.roles);
      if (resolved.activeRole !== request.role) {
        throw rejected(
          "assistant.selection_changed",
          "The selected assistant changed. Review and send again.",
        );
      }
      const text = request.text.trim();
      if (!text || text.length > 6000) {
        throw rejected("assistant.text_invalid", "Message text is invalid.");
      }
      const characterSessionId = parseCanonicalId(
        "character-session",
        request.characterSessionId,
      );
      // Canonical turn service rechecks session membership/state and claims
      // tenant-wide request-ID idempotency in Postgres. This endpoint grants
      // no cross-persona action, financial approval or human DM access.
      return input.conversations.turn({
        authorizationHeader: request.authorizationHeader,
        characterId,
        characterSessionId,
        text,
        requestId: request.requestId,
        correlationId: request.correlationId,
        surface: "mobile",
        representation: "platform-agent",
      });
    },

    async turnStatus({ authorizationHeader, role, requestId }) {
      const resolved = await roles(authorizationHeader);
      const characterId = roleId(role, resolved.roles);
      // Status check is allowed for either still-authorized role after switch
      // so an uncertain earlier turn can be reconciled without rerunning it.
      return input.shell.turnStatus({
        authorizationHeader, characterId, requestId,
      });
    },
  });
}
