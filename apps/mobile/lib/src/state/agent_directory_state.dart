import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_directory.dart';
import '../agents/agent_feedback.dart';
import '../agents/agent_shell.dart';
import '../core/mobile_push.dart';
import '../core/providers.dart';
import '../core/network/api_client.dart';
import 'session_state.dart';

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
  @override
  AgentDirectoryState build() {
    ref.watch(agentDirectoryTransportProvider);
    ref.watch(
      sessionProvider.select(
        (session) =>
            session is SessionSignedIn ? session.tokens.accessToken : null,
      ),
    );
    _disposed = false;
    ref.onDispose(() {
      _disposed = true;
      _request++;
    });
    scheduleMicrotask(refresh);
    return const AgentDirectoryState();
  }

  Future<void> refresh() async {
    if (_disposed) return;
    final request = ++_request;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final agents = await ref
          .read(agentDirectoryTransportProvider)
          .loadDirectory();
      if (_disposed || request != _request) return;
      state = AgentDirectoryState(
        agents: List.unmodifiable(agents),
        loading: false,
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
      if (_disposed || request != _request) return;
      final feedback = AgentFeedback.fromError(error);
      state = state.copyWith(
        // Transient failure must not erase the last successfully loaded roster.
        // Authorization failures remove it so another account cannot reuse it.
        agents:
            error is ApiException &&
                (error.statusCode == 401 || error.statusCode == 403)
            ? const []
            : null,
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
