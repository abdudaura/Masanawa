/// Server-driven projection used by the mobile shell.
///
/// This is intentionally presentation-only. Character identity is owned by the
/// platform identity domain; Skills remain independently assigned server-side.
/// The app never infers capabilities from [roleLabel].
enum AgentPresence {
  available,
  listening,
  working,
  onCall,
  offline;

  static AgentPresence parse(String? value) => switch (value) {
        'listening' => AgentPresence.listening,
        'working' => AgentPresence.working,
        'on_call' => AgentPresence.onCall,
        'offline' => AgentPresence.offline,
        _ => AgentPresence.available,
      };

  String get label => switch (this) {
        AgentPresence.available => 'Available',
        AgentPresence.listening => 'Listening…',
        AgentPresence.working => 'Working',
        AgentPresence.onCall => 'On a call',
        AgentPresence.offline => 'Offline',
      };
}

class AgentDirectoryEntry {
  const AgentDirectoryEntry({
    required this.characterId,
    required this.characterVersionId,
    required this.displayName,
    required this.roleLabel,
    required this.about,
    required this.presence,
    this.avatarUrl,
    this.greeting,
    this.activeWorkCount = 0,
  });

  final String characterId;
  final String characterVersionId;
  final String displayName;

  /// Admin-configured presentation label. It is not a Skill or authority grant.
  final String roleLabel;
  final String about;
  final AgentPresence presence;
  final String? avatarUrl;
  final String? greeting;
  final int activeWorkCount;

  String get initial =>
      displayName.trim().isEmpty ? 'M' : displayName.trim()[0].toUpperCase();

  String get presenceLabel {
    if (presence == AgentPresence.working && activeWorkCount > 0) {
      return 'Working · $activeWorkCount ${activeWorkCount == 1 ? 'task' : 'tasks'}';
    }
    return presence.label;
  }

  factory AgentDirectoryEntry.fromJson(Map<String, dynamic> json) {
    String requiredString(String key) {
      final value = json[key];
      if (value is! String || value.trim().isEmpty) {
        throw FormatException('Agent directory entry is missing $key');
      }
      return value.trim();
    }

    final work = json['activeWorkCount'];
    return AgentDirectoryEntry(
      characterId: requiredString('characterId'),
      characterVersionId: requiredString('characterVersionId'),
      displayName: requiredString('displayName'),
      roleLabel: requiredString('roleLabel'),
      about: (json['about'] as String? ?? '').trim(),
      presence: AgentPresence.parse(json['presence'] as String?),
      avatarUrl: (json['avatarUrl'] as String?)?.trim(),
      greeting: (json['greeting'] as String?)?.trim(),
      activeWorkCount: work is int && work >= 0 ? work : 0,
    );
  }
}

abstract class AgentDirectoryTransport {
  Future<List<AgentDirectoryEntry>> loadDirectory();
}

/// Used when no live Masanawa runtime is configured. Deliberately empty:
/// agent identities are never invented or hard-coded in the client.
class EmptyAgentDirectoryTransport implements AgentDirectoryTransport {
  const EmptyAgentDirectoryTransport();

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async => const [];
}
