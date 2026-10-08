import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';

const _user = AuthUser(
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  locale: 'en-NG',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-05T00:00:00Z',
);

AuthTokens _tokens() => AuthTokens(
  accessToken: 'session-token',
  refreshToken: 'refresh',
  accessExpiresIn: 900,
  user: _user,
);

class _Session extends SessionController {
  @override
  SessionState build() => SessionSignedIn(_user, _tokens());

  void signOutForTest() => state = const SessionSignedOut();
}

AgentDirectoryEntry _agent(String id, bool selected) => AgentDirectoryEntry(
  characterId: id,
  characterVersionId: 'version-$id',
  displayName: id == 'gwani' ? 'Gwani' : 'Gwana',
  roleLabel: 'Masanawa Support',
  about: 'Support',
  presence: AgentPresence.available,
  supportAgent: true,
  defaultPlatformAgent: selected,
);

class _Cache implements AgentDirectoryCache {
  String? owner;
  List<AgentDirectoryEntry>? entries;
  int writes = 0;
  int clears = 0;

  @override
  Future<List<AgentDirectoryEntry>?> read(String ownerId) async =>
      ownerId == owner ? entries : null;

  @override
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents) async {
    owner = ownerId;
    entries = List.unmodifiable(agents);
    writes++;
  }

  @override
  Future<void> clear() async {
    owner = null;
    entries = null;
    clears++;
  }
}

class _Transport implements AgentDirectoryTransport {
  String selected = 'gwani';
  bool staleReadback = false;
  bool rejectReadback = false;
  Completer<void>? pendingWrite;
  int writes = 0;
  int reads = 0;

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    reads++;
    if (rejectReadback) throw StateError('Network down');
    final active = staleReadback ? 'gwani' : selected;
    return [
      _agent('gwani', active == 'gwani'),
      _agent('gwana', active == 'gwana'),
    ];
  }

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {
    writes++;
    final hold = pendingWrite;
    if (hold != null) await hold.future;
    selected = characterId;
  }
}

Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

ProviderContainer _container(_Transport transport, _Cache cache) {
  final container = ProviderContainer(overrides: [
    agentDirectoryCacheProvider.overrideWithValue(cache),
    agentDirectoryTransportProvider.overrideWithValue(transport),
    sessionProvider.overrideWith(_Session.new),
  ]);
  container.read(agentDirectoryProvider);
  return container;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('default agent changes only after a server write and authorized readback', () async {
    final cache = _Cache();
    final transport = _Transport();
    final container = _container(transport, cache);
    addTearDown(container.dispose);
    await _settle();
    final change = container.read(agentDirectoryProvider.notifier)
        .changeDefaultSupportAgent('gwana');
    await change;
    final entries = container.read(agentDirectoryProvider).agents;
    expect(entries.where((a) => a.defaultPlatformAgent).single.characterId, 'gwana');
    expect(transport.writes, 1);
    expect(transport.reads, greaterThanOrEqualTo(2));
    expect(cache.owner, _user.id);
    expect(cache.entries?.where((a) => a.defaultPlatformAgent).single.characterId, 'gwana');
  });

  test('a slow write never optimistically changes selection', () async {
    final cache = _Cache();
    final transport = _Transport()..pendingWrite = Completer<void>();
    final container = _container(transport, cache);
    addTearDown(container.dispose);
    await _settle();
    final change = container.read(agentDirectoryProvider.notifier)
        .changeDefaultSupportAgent('gwana');
    expect(container.read(agentDirectoryProvider).agents
        .where((a) => a.defaultPlatformAgent).single.characterId, 'gwani');
    transport.pendingWrite!.complete();
    await change;
    expect(container.read(agentDirectoryProvider).agents
        .where((a) => a.defaultPlatformAgent).single.characterId, 'gwana');
  });

  test('stale or ambiguous authoritative GET rejects successful PUT', () async {
    final transport = _Transport()..staleReadback = true;
    final container = _container(transport, _Cache());
    addTearDown(container.dispose);
    await _settle();
    await expectLater(
      container.read(agentDirectoryProvider.notifier)
          .changeDefaultSupportAgent('gwana'),
      throwsStateError,
    );
    final state = container.read(agentDirectoryProvider);
    expect(state.error, contains('not verified'));
    expect(state.agents.where((a) => a.defaultPlatformAgent).single.characterId,
        'gwani');
  });

  test('failed readback keeps prior preference and exposes recovery', () async {
    final transport = _Transport();
    final container = _container(transport, _Cache());
    addTearDown(container.dispose);
    await _settle();
    transport.rejectReadback = true;
    await expectLater(
      container.read(agentDirectoryProvider.notifier)
          .changeDefaultSupportAgent('gwana'),
      throwsStateError,
    );
    expect(container.read(agentDirectoryProvider).agents
        .where((a) => a.defaultPlatformAgent).single.characterId, 'gwani');
    expect(container.read(agentDirectoryProvider).error, isNotNull);
  });

  test('logout during pending save cannot disclose old account preference', () async {
    final cache = _Cache();
    final transport = _Transport()..pendingWrite = Completer<void>();
    final container = _container(transport, cache);
    addTearDown(container.dispose);
    await _settle();
    final change = container.read(agentDirectoryProvider.notifier)
        .changeDefaultSupportAgent('gwana');
    (container.read(sessionProvider.notifier) as _Session).signOutForTest();
    await _settle();
    transport.pendingWrite!.complete();
    await expectLater(change, throwsStateError);
    await _settle();
    expect(container.read(agentDirectoryProvider).agents, isEmpty);
    expect(cache.entries, isNull);
  });

  test('a non-support Character is never sent as preference', () async {
    final transport = _Transport();
    final container = _container(transport, _Cache());
    addTearDown(container.dispose);
    await _settle();
    await expectLater(
      container.read(agentDirectoryProvider.notifier)
          .changeDefaultSupportAgent('unlisted-persona'),
      throwsStateError,
    );
    expect(transport.writes, 0);
  });
}
