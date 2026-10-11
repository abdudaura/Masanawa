import '../../l10n/app_localizations.dart';
import 'agent_directory.dart';

/// Server-presence types, never English labels, determine translated status.
/// Unknown or cached presence must remain unverified, not available/offline.
String localizedAgentPresence(
  AppLocalizations strings,
  AgentDirectoryEntry agent,
) {
  if (agent.presence == AgentPresence.working && agent.activeWorkCount > 0) {
    return strings.statusWorkingTasks(agent.activeWorkCount);
  }
  return switch (agent.presence) {
    AgentPresence.available => strings.statusAvailable,
    AgentPresence.listening => strings.statusListening,
    AgentPresence.working => strings.statusWorking,
    AgentPresence.onCall => strings.statusOnCall,
    AgentPresence.offline => strings.statusOffline,
    AgentPresence.unknown => strings.statusUnverified,
  };
}
