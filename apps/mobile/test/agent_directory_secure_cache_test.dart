import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';

const _gwani = AgentDirectoryEntry(
  characterId: 'character-gwani',
  characterVersionId: 'character-version-gwani',
  displayName: 'Gwani',
  roleLabel: 'AI guide',
  about: 'Platform support',
  presence: AgentPresence.working,
  activeWorkCount: 9,
  supportAgent: true,
  defaultPlatformAgent: true,
  voiceProvider: 'gemini',
  voiceName: 'Bodi',
);

class _ProtectedMemoryStore implements AgentDirectoryProtectedStorage {
  final values = <String, String>{};
  bool rejectReads = false;
  bool rejectWrites = false;
  bool rejectDeletes = false;
  Completer<void>? holdNextWrite;
  final calls = <String>[];

  @override
  Future<String?> read(String key) async {
    calls.add('read');
    if (rejectReads) throw const FileSystemException('keychain unavailable');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    calls.add('write-start');
    if (rejectWrites) throw const FileSystemException('keychain unavailable');
    final hold = holdNextWrite;
    if (hold != null) {
      holdNextWrite = null;
      await hold.future;
    }
    values[key] = value;
    calls.add('write-end');
  }

  @override
  Future<void> delete(String key) async {
    calls.add('delete');
    if (rejectDeletes) throw const FileSystemException('keychain unavailable');
    values.remove(key);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  late _ProtectedMemoryStore storage;

  FileAgentDirectoryCache cache() => FileAgentDirectoryCache(
        protectedStorage: storage,
        legacyDirectoryProvider: () async => directory,
      );

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('masanawa-agent-roster-');
    storage = _ProtectedMemoryStore();
  });

  tearDown(() async {
    if (await directory.exists()) await directory.delete(recursive: true);
  });

  test('secure snapshot restores offline but never reports saved presence', () async {
    await cache().write('account-a', const [_gwani]);
    expect(directory.listSync(), isEmpty); // no readable snapshot on disk

    final restored = await cache().read('account-a');
    expect(restored, hasLength(1));
    expect(restored!.single.characterId, _gwani.characterId);
    expect(restored.single.defaultPlatformAgent, isTrue);
    expect(restored.single.voiceName, 'Bodi');
    expect(restored.single.presence, AgentPresence.unknown);
    expect(restored.single.activeWorkCount, 0);

    final raw = storage.values.values.single;
    expect(jsonDecode(raw)['version'], 2);
    expect(jsonDecode(raw)['agents'][0]['presence'], 'unknown');
  });

  test('another authenticated account cannot read previous account roster',
      () async {
    await cache().write('account-a', const [_gwani]);
    expect(await cache().read('account-b'), isNull);
    await cache().write('account-b', const []);
    expect(await cache().read('account-a'), isNull);
    expect(await cache().read('account-b'), isEmpty);
    await cache().clear();
    expect(await cache().read('account-b'), isNull);
  });

  test('deletes readable legacy snapshots without importing their contents',
      () async {
    final old = File(
      directory.path + Platform.pathSeparator +
          'masanawa_agent_directory_v1.json',
    );
    final temp = File(old.path + '.tmp');
    await old.writeAsString(jsonEncode({
      'ownerId': 'account-a',
      'agents': [_gwani.toJson()],
    }));
    await temp.writeAsString('stale personal data');
    expect(await cache().read('account-a'), isNull);
    expect(await old.exists(), isFalse);
    expect(await temp.exists(), isFalse);
    expect(storage.values, isEmpty);
  });

  test('purges legacy data even when native storage cannot write', () async {
    final old = File(
      directory.path + Platform.pathSeparator +
          'masanawa_agent_directory_v1.json',
    );
    await old.writeAsString('do not restore');
    storage.rejectWrites = true;
    await cache().write('account-a', const [_gwani]);
    expect(await old.exists(), isFalse);
    expect(directory.listSync(), isEmpty);
    expect(storage.values, isEmpty);
  });

  test('damaged or oversized secure data fails closed', () async {
    const key = 'masanawa.agent_directory.v2';
    storage.values[key] = '{invalid';
    expect(await cache().read('account-a'), isNull);
    storage.values[key] = jsonEncode({
      'version': 1,
      'ownerId': 'account-a',
      'agents': [_gwani.toJson()],
    });
    expect(await cache().read('account-a'), isNull);
    storage.values[key] = jsonEncode({
      'version': 2,
      'ownerId': 'account-a',
      'agents': <Object?>[123],
    });
    expect(await cache().read('account-a'), isNull);
    storage.values[key] = 'x' * (256 * 1024 + 1);
    expect(await cache().read('account-a'), isNull);
  });

  test('empty-owner and oversized snapshots are never persisted', () async {
    await cache().write('', const [_gwani]);
    expect(storage.values, isEmpty);
    await cache().write('account-a', List.filled(251, _gwani));
    expect(storage.values, isEmpty);
    expect(await cache().read(''), isNull);
  });

  test('unavailable native keychain never falls back to a readable file',
      () async {
    storage.rejectReads = true;
    storage.rejectWrites = true;
    storage.rejectDeletes = true;
    await cache().write('account-a', const [_gwani]);
    expect(await cache().read('account-a'), isNull);
    await cache().clear();
    expect(directory.listSync(), isEmpty);
  });

  test('slow pre-logout write cannot resurrect roster after clear', () async {
    final gate = Completer<void>();
    storage.holdNextWrite = gate;
    final oldWrite = cache().write('account-a', const [_gwani]);
    // Start clear while prior write is suspended in the native keychain.
    await Future<void>.delayed(Duration.zero);
    final signOutClear = cache().clear();
    expect(storage.calls, contains('write-start'));
    gate.complete();
    await Future.wait([oldWrite, signOutClear]);
    expect(storage.calls, containsAllInOrder(['write-end', 'delete']));
    expect(await cache().read('account-a'), isNull);
  });
}
