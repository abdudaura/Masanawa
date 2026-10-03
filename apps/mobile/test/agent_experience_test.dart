import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/chat/message_parts.dart';

void main() {
  test('agent directory accepts arbitrary admin-configured identity metadata', () {
    final agent = AgentDirectoryEntry.fromJson({
      'characterId': 'character-custom',
      'characterVersionId': 'character-version-custom',
      'displayName': 'Amina',
      'roleLabel': 'Sales & Outreach',
      'about': 'Handles prospecting and follow-up',
      'presence': 'working',
      'activeWorkCount': 2,
    });

    expect(agent.characterId, 'character-custom');
    expect(agent.displayName, 'Amina');
    expect(agent.roleLabel, 'Sales & Outreach');
    expect(agent.presenceLabel, 'Working · 2 tasks');
  });

  test('directory entry contains no Skill assignment surface', () {
    expect(
      () => AgentDirectoryEntry.fromJson({
        'characterId': 'character-custom',
        'characterVersionId': 'character-version-custom',
        'displayName': 'Amina',
        'roleLabel': 'Research',
        'about': '',
        'presence': 'available',
        'skillVersionIds': ['skill-version-1'],
      }),
      returnsNormally,
    );
  });

  test('structured artifact result carries durable file reference', () {
    final part = AgentMessagePart.fromJson({
      'kind': 'artifact',
      'title': 'October Sales Report',
      'status': 'completed',
      'file': {
        'fileId': 'file-123',
        'name': 'October-Sales.xlsx',
        'mimeType':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'sizeBytes': 291840,
        'downloadUrl': 'https://files.example.test/file-123',
      },
    });

    expect(part.kind, AgentMessagePartKind.artifact);
    expect(part.file?.fileId, 'file-123');
    expect(part.file?.name, 'October-Sales.xlsx');
  });

  test('work result supports chat-native progress', () {
    final part = AgentMessagePart.fromJson({
      'kind': 'work',
      'title': 'Research prospects',
      'status': 'working',
      'progressCurrent': 31,
      'progressTotal': 50,
      'referenceId': 'workflow-run-1',
    });

    expect(part.progressCurrent, 31);
    expect(part.progressTotal, 50);
    expect(part.referenceId, 'workflow-run-1');
  });
}
