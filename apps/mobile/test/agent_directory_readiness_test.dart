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
    expect(entry.presence, AgentPresence.offline);
    expect(entry.presenceLabel, 'Offline');
  });

  test('unknown agent presence is not advertised as available', () {
    final entry = AgentDirectoryEntry.fromJson(
      entryWithPresence('initializing'),
    );
    expect(entry.presence, AgentPresence.offline);
  });

  test('malformed presence does not crash the whole agent directory', () {
    final entry = AgentDirectoryEntry.fromJson(entryWithPresence(123));
    expect(entry.presence, AgentPresence.offline);
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
    expect(restored.presence, AgentPresence.offline);
  });
}
