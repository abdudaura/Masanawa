import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';

Map<String, dynamic> entryWithPresence(Object? value) => {
  'characterId': 'character-gwani',
  'characterVersionId': 'character-version-gwani',
  'displayName': 'Gwani',
  'roleLabel': 'AI conversation guide',
  'about': 'Masanawa assistant',
  if (value != null) 'presence': value,
};

void main() {
  test('an explicitly available agent remains available', () {
    final entry = AgentDirectoryEntry.fromJson(
      entryWithPresence('available'),
    );
    expect(entry.presence, AgentPresence.available);
    expect(entry.presenceLabel, 'Available');
  });

  test('missing agent presence is not advertised as available', () {
    final entry = AgentDirectoryEntry.fromJson(entryWithPresence(null));
    expect(entry.presence, AgentPresence.unknown);
    expect(entry.presenceLabel, 'Status unverified');
  });

  test('unknown agent presence is not advertised as available', () {
    final entry = AgentDirectoryEntry.fromJson(
      entryWithPresence('initializing'),
    );
    expect(entry.presence, AgentPresence.unknown);
  });

  test('malformed presence stays unverified without inventing offline status', () {
    final entry = AgentDirectoryEntry.fromJson(entryWithPresence(123));
    expect(entry.presence, AgentPresence.unknown);
    expect(entry.presenceLabel, 'Status unverified');
    expect(entry.toJson()['presence'], 'unknown');
  });

  test('all recognized nonavailable states remain intact', () {
    expect(AgentPresence.parse('listening'), AgentPresence.listening);
    expect(AgentPresence.parse('working'), AgentPresence.working);
    expect(AgentPresence.parse('on_call'), AgentPresence.onCall);
    expect(AgentPresence.parse('offline'), AgentPresence.offline);
  });

  test('unavailable directory entry preserves state across cache JSON', () {
    final entry = AgentDirectoryEntry.fromJson(
      entryWithPresence('unknown'),
    );
    final restored = AgentDirectoryEntry.fromJson(entry.toJson());
    expect(restored.presence, AgentPresence.unknown);
  });
  test('unverified snapshot retains persona identity but drops stale activity', () {
    final entry = AgentDirectoryEntry.fromJson({
      ...entryWithPresence('working'),
      'activeWorkCount': 8,
      'supportAgent': true,
      'defaultPlatformAgent': true,
      'voiceProvider': 'gemini',
      'voiceName': 'Bodi',
    });
    final restored = entry.withUnverifiedPresence();
    expect(restored.characterId, entry.characterId);
    expect(restored.characterVersionId, entry.characterVersionId);
    expect(restored.displayName, entry.displayName);
    expect(restored.defaultPlatformAgent, isTrue);
    expect(restored.voiceName, 'Bodi');
    expect(restored.presence, AgentPresence.unknown);
    expect(restored.activeWorkCount, 0);
    expect(restored.presenceLabel, 'Status unverified');
    expect(restored.toJson()['presence'], 'unknown');
  });

  test('offline is preserved as an explicit status, not an unknown state', () {
    final entry = AgentDirectoryEntry.fromJson(entryWithPresence('offline'));
    expect(entry.presence, AgentPresence.offline);
    expect(entry.presenceLabel, 'Offline');
  });

}
