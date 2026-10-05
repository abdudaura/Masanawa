import 'dart:convert';

import 'shell_document.dart';

enum ShellActionState { pending, completed }

/// Stores sensitive form values and opaque action tokens. The host must use
/// encrypted, user/session-scoped storage and clear it on account removal.
class ShellActionRecord {
  const ShellActionRecord({required this.action, required this.state});
  final ShellAction action;
  final ShellActionState state;
}

abstract class ShellActionJournal {
  Future<ShellActionRecord?> read(String key);

  /// Atomically creates a pending record only when the key is absent.
  Future<bool> createPending(String key, ShellAction action);

  /// Monotonic completion; must never replace the original stored terms.
  Future<void> complete(String key);
}

/// Both ports must use authenticated canonical Gateway commands. Dispatch must
/// be server-idempotent by the action's server-issued token and exact terms.
abstract class ShellActionDispatcher {
  Future<void> dispatch(ShellAction action);

  /// True only when the server confirms the original selection was accepted.
  /// False includes absent, failed and pending; no blind redispatch is allowed.
  Future<bool> accepted(ShellAction action);
}

class ShellActionUncertain implements Exception {
  const ShellActionUncertain();
  @override
  String toString() => 'Selection status requires server reconciliation';
}

class ShellActionConflict implements Exception {
  const ShellActionConflict();
  @override
  String toString() => 'Selection terms changed; request fresh options';
}

/// Persist-before-send guard surviving widget recreation and process restarts.
/// It is presentation infrastructure, not an alternative transaction engine.
class ShellActionCoordinator {
  ShellActionCoordinator({
    required this.scope,
    required this.journal,
    required this.dispatcher,
  }) {
    if (scope.trim().isEmpty) throw ArgumentError('Scoped session required');
  }
  final String scope;
  final ShellActionJournal journal;
  final ShellActionDispatcher dispatcher;
  final Set<String> _active = {};

  String _key(ShellAction action) =>
      jsonEncode([scope, action.documentId, action.revision]);

  bool _same(ShellAction a, ShellAction b) =>
      a.documentId == b.documentId &&
      a.revision == b.revision &&
      a.nodeId == b.nodeId &&
      a.actionId == b.actionId &&
      a.token == b.token &&
      a.values.length == b.values.length &&
      a.values.entries.every((entry) => b.values[entry.key] == entry.value);

  Future<void> submit(ShellAction action) async {
    final key = _key(action);
    if (!_active.add(key)) throw const ShellActionUncertain();
    try {
      final snapshot = ShellAction(
        documentId: action.documentId,
        revision: action.revision,
        nodeId: action.nodeId,
        actionId: action.actionId,
        token: action.token,
        values: Map.unmodifiable(action.values),
      );
      // Atomic claim prevents different options racing across widget instances.
      // Failure here prevents network submission.
      final created = await journal.createPending(key, snapshot);
      if (!created) {
        final existing = await journal.read(key);
        if (existing == null) throw const ShellActionUncertain();
        if (!_same(existing.action, snapshot))
          throw const ShellActionConflict();
        if (existing.state == ShellActionState.completed) return;
        if (!await dispatcher.accepted(existing.action)) {
          throw const ShellActionUncertain();
        }
        await journal.complete(key);
        return;
      }
      try {
        await dispatcher.dispatch(snapshot);
        await journal.complete(key);
      } catch (_) {
        // Pending survives ambiguous network and local completion-write failures.
        // Never resubmit: query the authoritative result using original terms.
        throw const ShellActionUncertain();
      }
    } finally {
      _active.remove(key);
    }
  }
}
