import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';

const cachedAgent = AgentDirectoryEntry(
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

const user = AuthUser(
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  locale: 'en-NG',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-05T00:00:00Z',
);

AuthTokens tokens(String access) => AuthTokens(
      accessToken: access,
      refreshToken: 'refresh',
      accessExpiresIn: 900,
      user: user,
    );

class MutableSignedInSessionController extends SessionController {
  @override
  SessionState build() => SessionSignedIn(user, tokens('access-1'));

  void rotate(String access) {
    state = SessionSignedIn(user, tokens(access));
  }

  void signOutForTest() {
    state = const SessionSignedOut();
  }
}

class MemoryDirectoryCache implements AgentDirectoryCache {
  MemoryDirectoryCache({this.ownerId, this.agents});

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

class PendingDirectoryTransport implements AgentDirectoryTransport {
  final requests = <Completer<List<AgentDirectoryEntry>>>[];

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() {
    final completer = Completer<List<AgentDirectoryEntry>>();
    requests.add(completer);
    return completer.future;
  }

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {}
}

Future<void> settleMicrotasks() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('cached roster renders before the live directory response', () async {
    final cache = MemoryDirectoryCache(
      ownerId: user.id,
      agents: const [cachedAgent],
    );
    final transport = PendingDirectoryTransport();
    final container = ProviderContainer(
      overrides: [
        agentDirectoryCacheProvider.overrideWithValue(cache),
        agentDirectoryTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(MutableSignedInSessionController.new),
      ],
    );
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await settleMicrotasks();

    final cached = container.read(agentDirectoryProvider);
    expect(cached.agents.single.displayName, 'Gwani');
    expect(cached.loading, isTrue);
    expect(transport.requests, hasLength(1));

    transport.requests.single.complete(const []);
    await settleMicrotasks();

    final fresh = container.read(agentDirectoryProvider);
    expect(fresh.loading, isFalse);
    expect(fresh.agents, isEmpty);
    expect(cache.writes, 1);
  });

  test('access-token rotation does not restart directory loading', () async {
    final cache = MemoryDirectoryCache(
      ownerId: user.id,
      agents: const [cachedAgent],
    );
    final transport = PendingDirectoryTransport();
    final container = ProviderContainer(
      overrides: [
        agentDirectoryCacheProvider.overrideWithValue(cache),
        agentDirectoryTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(MutableSignedInSessionController.new),
      ],
    );
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await settleMicrotasks();
    expect(transport.requests, hasLength(1));

    final session =
        container.read(sessionProvider.notifier) as MutableSignedInSessionController;
    session.rotate('access-2');
    await settleMicrotasks();

    expect(transport.requests, hasLength(1));
    transport.requests.single.complete(const []);
  });

  test('sign-out clears the account-scoped cached roster', () async {
    final cache = MemoryDirectoryCache(
      ownerId: user.id,
      agents: const [cachedAgent],
    );
    final transport = PendingDirectoryTransport();
    final container = ProviderContainer(
      overrides: [
        agentDirectoryCacheProvider.overrideWithValue(cache),
        agentDirectoryTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(MutableSignedInSessionController.new),
      ],
    );
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await settleMicrotasks();
    final session =
        container.read(sessionProvider.notifier) as MutableSignedInSessionController;
    session.signOutForTest();
    await settleMicrotasks();

    expect(cache.clears, greaterThanOrEqualTo(1));
    expect(container.read(agentDirectoryProvider).agents, isEmpty);
    if (!transport.requests.single.isCompleted) {
      transport.requests.single.complete(const []);
    }
  });

  test('cache from another account is never rendered', () async {
    final cache = MemoryDirectoryCache(
      ownerId: 'user-other',
      agents: const [cachedAgent],
    );
    final transport = PendingDirectoryTransport();
    final container = ProviderContainer(
      overrides: [
        agentDirectoryCacheProvider.overrideWithValue(cache),
        agentDirectoryTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(MutableSignedInSessionController.new),
      ],
    );
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await settleMicrotasks();

    final state = container.read(agentDirectoryProvider);
    expect(state.agents, isEmpty);
    expect(state.loading, isTrue);
    expect(cache.reads, 1);
    expect(transport.requests, hasLength(1));

    transport.requests.single.complete(const []);
    await settleMicrotasks();
  });

  test('authorization denial clears both cached and visible roster', () async {
    final cache = MemoryDirectoryCache(
      ownerId: user.id,
      agents: const [cachedAgent],
    );
    final transport = PendingDirectoryTransport();
    final container = ProviderContainer(
      overrides: [
        agentDirectoryCacheProvider.overrideWithValue(cache),
        agentDirectoryTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(MutableSignedInSessionController.new),
      ],
    );
    addTearDown(container.dispose);

    container.read(agentDirectoryProvider);
    await settleMicrotasks();
    expect(container.read(agentDirectoryProvider).agents, isNotEmpty);

    transport.requests.single.completeError(
      const ApiException('denied', statusCode: 401),
    );
    await settleMicrotasks();

    expect(cache.clears, 1);
    expect(cache.agents, isNull);
    expect(container.read(agentDirectoryProvider).agents, isEmpty);
  });

  test('directory presentation round-trips through cache JSON shape', () {
    final restored = AgentDirectoryEntry.fromJson(cachedAgent.toJson());
    expect(restored.characterId, cachedAgent.characterId);
    expect(restored.displayName, 'Gwani');
    expect(restored.defaultPlatformAgent, isTrue);
    expect(restored.voiceName, 'Bodi');
  });
}
