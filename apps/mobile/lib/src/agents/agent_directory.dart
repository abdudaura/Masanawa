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
  offline,
  unknown;

  static AgentPresence parse(String? value) => switch (value) {
        'listening' => AgentPresence.listening,
        'working' => AgentPresence.working,
        'on_call' => AgentPresence.onCall,
        'available' => AgentPresence.available,
        'offline' => AgentPresence.offline,
        'unknown' => AgentPresence.unknown,
        // Missing or unrecognized server presence is not proof that a visible
        // persona is offline or ready to chat. Do not invent availability.
        _ => AgentPresence.unknown,
      };

  String get label => switch (this) {
        AgentPresence.available => 'Available',
        AgentPresence.listening => 'Listening…',
        AgentPresence.working => 'Working',
        AgentPresence.onCall => 'On a call',
        AgentPresence.offline => 'Offline',
        AgentPresence.unknown => 'Status unverified',
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
    this.supportAgent = false,
    this.defaultPlatformAgent = false,
    this.voiceProvider,
    this.voiceName,
    this.roomId,
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
  final bool supportAgent;
  final bool defaultPlatformAgent;
  final String? voiceProvider;
  final String? voiceName;
  final String? roomId;

  /// Saved roster metadata is useful before refresh, but saved presence is
  /// historical. Never present it as a current runtime/voice availability check.
  AgentDirectoryEntry withUnverifiedPresence() => AgentDirectoryEntry(
        characterId: characterId,
        characterVersionId: characterVersionId,
        displayName: displayName,
        roleLabel: roleLabel,
        about: about,
        presence: AgentPresence.unknown,
        avatarUrl: avatarUrl,
        greeting: greeting,
        activeWorkCount: 0,
        supportAgent: supportAgent,
        defaultPlatformAgent: defaultPlatformAgent,
        voiceProvider: voiceProvider,
        voiceName: voiceName,
        roomId: roomId,
      );

  String get initial =>
      displayName.trim().isEmpty ? 'M' : displayName.trim()[0].toUpperCase();

  String get presenceLabel {
    if (presence == AgentPresence.working && activeWorkCount > 0) {
      return 'Working · $activeWorkCount ${activeWorkCount == 1 ? 'task' : 'tasks'}';
    }
    return presence.label;
  }

  Map<String, dynamic> toJson() => {
        'characterId': characterId,
        'characterVersionId': characterVersionId,
        'displayName': displayName,
        'roleLabel': roleLabel,
        'about': about,
        'presence': switch (presence) {
          AgentPresence.available => 'available',
          AgentPresence.listening => 'listening',
          AgentPresence.working => 'working',
          AgentPresence.onCall => 'on_call',
          AgentPresence.offline => 'offline',
          AgentPresence.unknown => 'unknown',
        },
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (greeting != null) 'greeting': greeting,
        'activeWorkCount': activeWorkCount,
        'supportAgent': supportAgent,
        'defaultPlatformAgent': defaultPlatformAgent,
        if (voiceProvider != null) 'voiceProvider': voiceProvider,
        if (voiceName != null) 'voiceName': voiceName,
        if (roomId != null) 'roomId': roomId,
      };

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
      presence: AgentPresence.parse(
        json['presence'] is String ? json['presence'] as String : null,
      ),
      avatarUrl: (json['avatarUrl'] as String?)?.trim(),
      greeting: (json['greeting'] as String?)?.trim(),
      activeWorkCount: work is int && work >= 0 ? work : 0,
      supportAgent: json['supportAgent'] == true,
      defaultPlatformAgent: json['defaultPlatformAgent'] == true,
      voiceProvider: (json['voiceProvider'] as String?)?.trim(),
      voiceName: (json['voiceName'] as String?)?.trim(),
      roomId: (json['roomId'] is String && (json['roomId'] as String).trim().isNotEmpty)
          ? (json['roomId'] as String).trim() : null,
    );
  }
}

abstract class AgentDirectoryTransport {
  Future<List<AgentDirectoryEntry>> loadDirectory();
  Future<void> setDefaultPlatformAgent(String characterId);
}

/// Used when no live Masanawa runtime is configured. Deliberately empty:
/// agent identities are never invented or hard-coded in the client.
class EmptyAgentDirectoryTransport implements AgentDirectoryTransport {
  const EmptyAgentDirectoryTransport();

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async => const [];

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {
    throw StateError('Agent runtime is not configured');
  }
}

class UnavailableAgentDirectoryTransport extends EmptyAgentDirectoryTransport {
  const UnavailableAgentDirectoryTransport();
}
