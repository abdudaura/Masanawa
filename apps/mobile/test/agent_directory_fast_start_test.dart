import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';

const _agent = AgentDirectoryEntry(
  characterId: 'character-gwani',
  characterVersionId: 'character-version-gwani',
  displayName: 'Gwani',
  roleLabel: 'Masanawa agent',
  about: 'Ready to help',
  presence: AgentPresence.available,
  supportAgent: true,
  defaultPlatformAgent: true,
  voiceProvider: 'gemini',
  voiceName: 'Bodi',
);

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

AuthTokens _tokens(String access) => AuthTokens(
      accessToken: access,
      refreshToken: 'refresh',
      accessExpiresIn: 900,
      user: _user,
    );

class _SessionController extends SessionController {
  @override
  SessionState build() => SessionSignedIn(_user, _tokens('access-1'));

  void rotate() => state = SessionSignedIn(_user, _tokens('access-2'));
  void signOutForTest() => state = const SessionSignedOut();
}

class _MemoryCache implements AgentDirectoryCache {
  _MemoryCache({this.ownerId, this.agents});

  String? ownerId;
  List<AgentDirectoryEntry>? agents;
  int reads = 0;
  int writes = 0;
  int clears = 0;

  @override
  Future<List<AgentDirectoryEntry>?> read(String ownerId) async {
    reads += 1;
    return this.ownerId == ownerId ? agents : null;
  }

  @override
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents) async {
    writes += 1;
    this.ownerId = ownerId;
    this.agents = List.unmodifiable(agents);
  }

  @override
  Future<void> clear() async {
    clears += 1;
    ownerId = null;
    agents = null;
  }
}

class _PendingTransport implements AgentDirectoryTransport {
  final requests = <Completer<List<AgentDirectoryEntry>>>[];

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() {
    final request = Completer<List<AgentDirectoryEntry>>();
    requests.add(request);
    return request.future;
  }

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {}
}

Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('cached account roster renders before live refresh completes', () async {
    final cache = _MemoryCache(ownerId: _user.id, agents: const [_agent]);
    final transport = _PendingTransport();
    final container = ProviderContainer(overrides: [
      agentDirectoryCacheProvider.overrideWithValue(cache),
      agentDirectoryTransportProvider.overrideWithValue(transport),
      sessionProvider.overrideWith(_SessionController.new),
    ]);
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await _settle();

    final cached = container.read(agentDirectoryProvider);
    expect(cached.agents.single.displayName, 'Gwani');
    expect(cached.loading, isTrue);
    expect(transport.requests, hasLength(1));

    transport.requests.single.complete(const []);
    await _settle();
    expect(container.read(agentDirectoryProvider).loading, isFalse);
    expect(cache.writes, 1);
  });

  test('access-token rotation does not restart directory loading', () async {
    final cache = _MemoryCache(ownerId: _user.id, agents: const [_agent]);
    final transport = _PendingTransport();
    final container = ProviderContainer(overrides: [
      agentDirectoryCacheProvider.overrideWithValue(cache),
      agentDirectoryTransportProvider.overrideWithValue(transport),
      sessionProvider.overrideWith(_SessionController.new),
    ]);
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await _settle();
    expect(transport.requests, hasLength(1));

    (container.read(sessionProvider.notifier) as _SessionController).rotate();
    await _settle();
    expect(transport.requests, hasLength(1));

    transport.requests.single.complete(const []);
  });

  test('another account cache is not rendered', () async {
    final cache = _MemoryCache(ownerId: 'user-other', agents: const [_agent]);
    final transport = _PendingTransport();
    final container = ProviderContainer(overrides: [
      agentDirectoryCacheProvider.overrideWithValue(cache),
      agentDirectoryTransportProvider.overrideWithValue(transport),
      sessionProvider.overrideWith(_SessionController.new),
    ]);
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await _settle();

    expect(container.read(agentDirectoryProvider).agents, isEmpty);
    expect(cache.reads, 1);
    transport.requests.single.complete(const []);
  });

  test('authorization denial clears cached and visible presentation', () async {
    final cache = _MemoryCache(ownerId: _user.id, agents: const [_agent]);
    final transport = _PendingTransport();
    final container = ProviderContainer(overrides: [
      agentDirectoryCacheProvider.overrideWithValue(cache),
      agentDirectoryTransportProvider.overrideWithValue(transport),
      sessionProvider.overrideWith(_SessionController.new),
    ]);
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await _settle();
    expect(container.read(agentDirectoryProvider).agents, isNotEmpty);

    transport.requests.single.completeError(
      const ApiException('denied', statusCode: 401),
    );
    await _settle();

    expect(cache.clears, 1);
    expect(container.read(agentDirectoryProvider).agents, isEmpty);
  });

  test('sign-out clears the account-scoped roster cache', () async {
    final cache = _MemoryCache(ownerId: _user.id, agents: const [_agent]);
    final transport = _PendingTransport();
    final container = ProviderContainer(overrides: [
      agentDirectoryCacheProvider.overrideWithValue(cache),
      agentDirectoryTransportProvider.overrideWithValue(transport),
      sessionProvider.overrideWith(_SessionController.new),
    ]);
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await _settle();
    (container.read(sessionProvider.notifier) as _SessionController)
        .signOutForTest();
    await _settle();

    expect(cache.clears, greaterThanOrEqualTo(1));
    expect(container.read(agentDirectoryProvider).agents, isEmpty);
    if (!transport.requests.single.isCompleted) {
      transport.requests.single.complete(const []);
    }
  });

  test('directory presentation JSON round-trips safely', () {
    final restored = AgentDirectoryEntry.fromJson(_agent.toJson());
    expect(restored.characterId, _agent.characterId);
    expect(restored.displayName, 'Gwani');
    expect(restored.defaultPlatformAgent, isTrue);
    expect(restored.voiceName, 'Bodi');
  });
}
