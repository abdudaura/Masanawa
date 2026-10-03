import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_directory.dart';
import '../core/providers.dart';

class AgentDirectoryState {
  const AgentDirectoryState({
    this.agents = const [],
    this.loading = true,
    this.error,
  });

  final List<AgentDirectoryEntry> agents;
  final bool loading;
  final String? error;

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
  }) =>
      AgentDirectoryState(
        agents: agents ?? this.agents,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class AgentDirectoryController extends Notifier<AgentDirectoryState> {
  @override
  AgentDirectoryState build() {
    scheduleMicrotask(refresh);
    return const AgentDirectoryState();
  }

  Future<void> refresh() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final agents =
          await ref.read(agentDirectoryTransportProvider).loadDirectory();
      state = AgentDirectoryState(
        agents: List.unmodifiable(agents),
        loading: false,
      );
    } catch (_) {
      state = const AgentDirectoryState(
        agents: [],
        loading: false,
        error: 'Could not load your agents.',
      );
    }
  }
}

final agentDirectoryProvider =
    NotifierProvider<AgentDirectoryController, AgentDirectoryState>(
  AgentDirectoryController.new,
);
