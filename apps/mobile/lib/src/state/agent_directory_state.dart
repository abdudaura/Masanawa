import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_directory.dart';
import '../agents/agent_directory_cache.dart';
import '../agents/agent_feedback.dart';
import '../agents/agent_shell.dart';
import '../agents/twin_directory.dart';
import '../core/mobile_push.dart';
import '../core/providers.dart';
import '../core/network/api_client.dart';
import 'session_state.dart';

final agentDirectoryCacheProvider = Provider<AgentDirectoryCache>((ref) {
  return const FileAgentDirectoryCache();
});

class AgentDirectoryState {
  const AgentDirectoryState({
    this.agents = const [],
    this.loading = true,
    this.error,
    this.recovery = AgentRecovery.retry,
  });

  final List<AgentDirectoryEntry> agents;
  final bool loading;
  final String? error;
  final AgentRecovery recovery;

  AgentDirectoryEntry? find(String characterId) {
    for (final agent in agents) {
      if (agent.characterId == characterId) return agent;
    }
    return null;
  }

  AgentDirectoryState copyWith({
    List<AgentDirectoryEntry>? agents,
    bool? loading,
    String? error,
    bool clearError = false,
    AgentRecovery? recovery,
  }) => AgentDirectoryState(
    agents: agents ?? this.agents,
    loading: loading ?? this.loading,
    error: clearError ? null : (error ?? this.error),
    recovery: recovery ?? this.recovery,
  );
}

class AgentDirectoryController extends Notifier<AgentDirectoryState> {
  int _request = 0;
  bool _disposed = false;
  String? _ownerId;

  @override
  AgentDirectoryState build() {
    ref.watch(agentDirectoryTransportProvider);
    final ownerId = ref.watch(
      sessionProvider.select(
        (session) => session is SessionSignedIn ? session.user.id : null,
      ),
    );
    ref.watch(agentDirectoryCacheProvider);

    _disposed = false;
    _ownerId = ownerId;
    final request = ++_request;
    final cache = ref.read(agentDirectoryCacheProvider);

    ref.listen<SessionState>(sessionProvider, (previous, next) {
      if (previous is SessionSignedIn && next is! SessionSignedIn) {
        _ownerId = null;
        _request++;
        state = const AgentDirectoryState(loading: false);
        unawaited(cache.clear().catchError((_) {}));
      }
    });

    ref.onDispose(() {
      _disposed = true;
      _request++;
    });

    if (ownerId == null || ownerId.isEmpty) {
      unawaited(cache.clear().catchError((_) {}));
      return const AgentDirectoryState(loading: false);
    }

    scheduleMicrotask(() => _restoreThenRefresh(ownerId, request));
    return const AgentDirectoryState(loading: true);
  }

  Future<void> _restoreThenRefresh(String? ownerId, int request) async {
    final cache = ref.read(agentDirectoryCacheProvider);

    if (ownerId == null || ownerId.isEmpty) {
      await cache.clear();
      if (_disposed || request != _request) return;
      state = const AgentDirectoryState(loading: false);
      return;
    }

    final cached = await cache.read(ownerId);
    if (_disposed || request != _request || _ownerId != ownerId) return;

    if (cached != null && cached.isNotEmpty) {
      state = AgentDirectoryState(
        agents: List.unmodifiable([
          for (final agent in cached) agent.withUnverifiedPresence(),
        ]),
        loading: true,
      );
    }

    await _refreshForOwner(ownerId, request);
  }

  void primeTwin(TwinDirectoryEntry twin) {
    if (state.find(twin.characterId) != null) return;
    final preview = AgentDirectoryEntry(
      characterId: twin.characterId,
      characterVersionId: 'pending-public-twin',
      displayName: twin.displayName,
      roleLabel: 'AI twin',
      about: twin.bio,
      presence: AgentPresence.unknown,
      supportAgent: false,
      defaultPlatformAgent: false,
    );
    state = state.copyWith(
      agents: List.unmodifiable([...state.agents, preview]),
      clearError: true,
    );
  }

  /// Change an authenticated user's default support agent. This is a server
  /// preference, not an optimistic local radio-button toggle. A successful PUT
  /// is followed by a fresh authorized GET before acknowledging the choice.
  /// On unknown network outcomes the UI remains unchanged and offers retry.
  Future<void> changeDefaultSupportAgent(String characterId) async {
    if (_disposed) throw StateError('Agent directory is no longer available');
    final session = ref.read(sessionProvider);
    final ownerId = session is SessionSignedIn ? session.user.id : null;
    if (ownerId == null || ownerId != _ownerId) {
      throw StateError('Sign in before changing your default agent');
    }
    final candidate = state.find(characterId);
    if (candidate == null || !candidate.supportAgent) {
      throw StateError('This support agent is not in your current directory');
    }

    // Invalidate in-flight directory refreshes while the preference is saved.
    final request = ++_request;
    final transport = ref.read(agentDirectoryTransportProvider);
    bool stillOwner() {
      if (_disposed || request != _request || _ownerId != ownerId) {
        return false;
      }
      final current = ref.read(sessionProvider);
      return current is SessionSignedIn && current.user.id == ownerId;
    }

    try {
      await transport.setDefaultPlatformAgent(characterId);
      if (!stillOwner()) throw StateError('Account changed while saving');
      final authoritative = await transport.loadDirectory();
      if (!stillOwner()) throw StateError('Account changed while saving');

      final selections = authoritative
          .where((agent) => agent.defaultPlatformAgent)
          .toList(growable: false);
      if (selections.length != 1 ||
          selections.single.characterId != characterId ||
          !selections.single.supportAgent) {
        throw StateError(
          'Could not verify the saved agent. Refresh before retrying.',
        );
      }
      final verified = List<AgentDirectoryEntry>.unmodifiable(authoritative);
      state = AgentDirectoryState(agents: verified, loading: false);
      // Keep the last authorized snapshot for offline first paint; it is not
      // treated as fresh availability when restored on another launch.
      if (stillOwner()) {
        // Disk cache is best-effort. A cache IO failure cannot change the
        // server-confirmed result into an apparent failed write.
        await ref.read(agentDirectoryCacheProvider)
            .write(ownerId, verified)
            .catchError((_) {});
      }
    } catch (_) {
      if (stillOwner()) {
        state = state.copyWith(
          agents: List.unmodifiable([
            for (final agent in state.agents) agent.withUnverifiedPresence(),
          ]),
          loading: false,
          error: 'Default agent not verified. Refresh your directory and retry.',
          recovery: AgentRecovery.retry,
        );
      }
      rethrow;
    }
  }

  Future<void> refresh() async {
    if (_disposed) return;
    final session = ref.read(sessionProvider);
    final ownerId = session is SessionSignedIn ? session.user.id : null;
    final request = ++_request;
    _ownerId = ownerId;

    if (ownerId == null || ownerId.isEmpty) {
      await ref.read(agentDirectoryCacheProvider).clear();
      if (_disposed || request != _request) return;
      state = const AgentDirectoryState(loading: false);
      return;
    }

    await _refreshForOwner(ownerId, request);
  }

  Future<void> _refreshForOwner(String ownerId, int request) async {
    if (_disposed || request != _request || _ownerId != ownerId) return;

    state = state.copyWith(
      agents: List.unmodifiable([
        for (final agent in state.agents) agent.withUnverifiedPresence(),
      ]),
      loading: true,
      clearError: true,
    );

    try {
      final agents = await ref
          .read(agentDirectoryTransportProvider)
          .loadDirectory();

      if (_disposed || request != _request || _ownerId != ownerId) return;

      final immutableAgents = List<AgentDirectoryEntry>.unmodifiable(agents);
      state = AgentDirectoryState(
        agents: immutableAgents,
        loading: false,
      );

      unawaited(
        ref
            .read(agentDirectoryCacheProvider)
            .write(ownerId, immutableAgents)
            .catchError((_) {}),
      );

      if (agents.isNotEmpty) {
        final transport = ref.read(agentTransportProvider);
        if (transport is AgentShellTransport) {
          final shellTransport = transport as AgentShellTransport;
          unawaited(
            MobilePushService.instance
                .registerForCharacter(shellTransport, agents.first.characterId)
                .catchError((_) {}),
          );
        }
      }
    } catch (error) {
      if (_disposed || request != _request || _ownerId != ownerId) return;

      final denied = error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403);
      if (denied) {
        await ref.read(agentDirectoryCacheProvider).clear();
        if (_disposed || request != _request || _ownerId != ownerId) return;
      }

      final feedback = AgentFeedback.fromError(error);
      state = state.copyWith(
        // Transient failure preserves the account-scoped cached roster.
        // Authorization failure clears it so no stale account presentation remains.
        agents: denied
            ? const []
            : List.unmodifiable([
                for (final agent in state.agents) agent.withUnverifiedPresence(),
              ]),
        loading: false,
        error: feedback.message,
        recovery: feedback.recovery,
      );
    }
  }
}

final agentDirectoryProvider =
    NotifierProvider<AgentDirectoryController, AgentDirectoryState>(
      AgentDirectoryController.new,
    );

