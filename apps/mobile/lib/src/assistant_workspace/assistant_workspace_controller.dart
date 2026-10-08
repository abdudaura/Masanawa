import 'dart:async';

import 'package:flutter/foundation.dart';

import '../agents/agent_directory.dart';
import '../agents/agent_session.dart';
import '../agents/agent_shell.dart';
import '../core/request_id.dart';

/// C07: a presentation adapter for canonical, server-authorized support
/// conversations. Never used for human messages, payments or AI Seat admission.
enum AssistantRole { gwani, gwana }

extension AssistantRoleLabel on AssistantRole {
  String get label => switch (this) {
    AssistantRole.gwani => 'Gwani',
    AssistantRole.gwana => 'Gwana',
  };
}

class AssistantTimelineEntry {
  const AssistantTimelineEntry({
    required this.role,
    required this.characterId,
    required this.message,
  });

  final AssistantRole role;
  final String characterId;
  final AgentHistoryMessage message;

  String get identityKey => characterId + ':' + message.key;
}

/// The journal stores only a request reference and input for recovering an
/// uncertain send. It must be backed by platform protected storage in release.
abstract class AssistantPendingJournal {
  Future<AssistantPendingTurn?> read(String ownerId);
  Future<void> write(String ownerId, AssistantPendingTurn turn);
  Future<void> clear(String ownerId);
}

class AssistantPendingTurn {
  const AssistantPendingTurn({
    required this.characterId,
    required this.role,
    required this.requestId,
    required this.text,
  });

  final String characterId;
  final AssistantRole role;
  final String requestId;
  final String text;

  Map<String, dynamic> toJson() => {
    'characterId': characterId,
    'role': role.name,
    'requestId': requestId,
    'text': text,
  };

  static AssistantPendingTurn fromJson(Map<String, dynamic> json) {
    final id = json['characterId'];
    final requestId = json['requestId'];
    final text = json['text'];
    final role = json['role'];
    if (id is! String || id.isEmpty ||
        requestId is! String || !requestId.startsWith('request_') ||
        text is! String || text.trim().isEmpty || text.length > 6000 ||
        role is! String) {
      throw const FormatException('Invalid pending assistant turn');
    }
    final resolved = AssistantRole.values.where((r) => r.name == role);
    if (resolved.length != 1) {
      throw const FormatException('Unknown assistant persona');
    }
    return AssistantPendingTurn(
      characterId: id, role: resolved.single, requestId: requestId, text: text,
    );
  }
}

/// Preserves server-acknowledged history and the same idempotency key across
/// retries and restarts. This does not elevate any model/agent output to an
/// authorized app action; payments and Host changes use their original guards.
class AssistantWorkspaceController extends ChangeNotifier {
  AssistantWorkspaceController({
    required this.directory,
    required this.agents,
    required this.shell,
    required this.journal,
    required String ownerId,
  }) : _ownerId = ownerId;

  final AgentDirectoryTransport directory;
  final AgentTransport agents;
  final AgentShellTransport shell;
  final AssistantPendingJournal journal;

  String _ownerId;
  int _generation = 0;
  bool _dead = false;
  bool busy = false;
  String? error;
  String? notice;
  AssistantRole? activeRole;
  AssistantPendingTurn? pending;
  Map<AssistantRole, AgentDirectoryEntry> roster = const {};
  List<AssistantTimelineEntry> history = const [];
  final Map<String, AgentSessionBinding> _bindings = {};

  bool get ready => activeRole != null && roster.length == 2;
  bool get canSend => ready && !busy && pending == null;
  String get ownerId => _ownerId;

  void _emit(int generation) {
    if (!_dead && generation == _generation) notifyListeners();
  }

  void changeOwner(String ownerId) {
    if (_ownerId == ownerId || _dead) return;
    _ownerId = ownerId;
    ++_generation;
    busy = false;
    error = null;
    notice = null;
    activeRole = null;
    pending = null;
    roster = const {};
    history = const [];
    _bindings.clear();
    notifyListeners();
    // The old owner's pending journal is deliberately retained for recovery
    // only upon that account's next authorized login.
  }

  static Map<AssistantRole, AgentDirectoryEntry> _validateRoster(
      List<AgentDirectoryEntry> entries) {
    final selected = <AssistantRole, AgentDirectoryEntry>{};
    for (final item in entries) {
      if (!item.supportAgent) continue;
      final name = item.displayName.trim().toLowerCase();
      final voice = item.voiceName?.trim().toLowerCase();
      // Match the Gateway's canonical /home projection: administrator
      // display labels may differ, but configured support voices are stable.
      final role = switch (name) {
        'gwani' => AssistantRole.gwani,
        'gwana' => AssistantRole.gwana,
        _ => switch (voice) {
          'bodi' => AssistantRole.gwani,
          'sulafat' => AssistantRole.gwana,
          _ => null,
        },
      };
      if (role == null) continue;
      if (selected.containsKey(role)) {
        throw StateError('Duplicate canonical support agent');
      }
      selected[role] = item;
    }
    if (selected.length != 2 ||
        selected[AssistantRole.gwani]!.characterId ==
            selected[AssistantRole.gwana]!.characterId) {
      throw StateError('Both canonical support agents must be configured');
    }
    return Map.unmodifiable(selected);
  }

  Future<void> load() async {
    if (_dead || busy || _ownerId.isEmpty) return;
    final generation = _generation;
    busy = true;
    error = null;
    _emit(generation);
    try {
      final entries = await directory.loadDirectory();
      if (_generation != generation || _dead) return;
      final verified = _validateRoster(entries);
      final defaults = verified.entries.where(
          (e) => e.value.defaultPlatformAgent).toList();
      if (defaults.length > 1) {
        throw StateError('Conflicting server assistant preference');
      }
      final selected = defaults.isNotEmpty
          ? defaults.single.key : AssistantRole.gwani;
      final recovered = await journal.read(_ownerId);
      if (_generation != generation || _dead) return;
      if (recovered != null &&
          verified[recovered.role]?.characterId != recovered.characterId) {
        throw StateError('Pending agent is no longer authorized');
      }
      roster = verified;
      activeRole = selected;
      pending = recovered;
      await _refreshHistory(generation);
    } catch (_) {
      if (_generation != generation || _dead) return;
      error = 'Assistant is unavailable. Check your session and retry.';
    } finally {
      if (_generation == generation && !_dead) {
        busy = false;
        _emit(generation);
      }
    }
  }

  Future<void> _refreshHistory(int generation) async {
    final results = await Future.wait([
      for (final role in AssistantRole.values)
        shell.loadHistory(roster[role]!.characterId, limit: 80),
    ]);
    if (_generation != generation || _dead) return;
    final seen = <String>{};
    final merged = <AssistantTimelineEntry>[];
    for (var i = 0; i < AssistantRole.values.length; ++i) {
      final role = AssistantRole.values[i];
      for (final message in results[i]) {
        final item = AssistantTimelineEntry(
            role: role,
            characterId: roster[role]!.characterId,
            message: message);
        if (message.key.isNotEmpty && seen.add(item.identityKey)) {
          merged.add(item);
        }
      }
    }
    merged.sort((a, b) {
      final byTime = a.message.createdAt.compareTo(b.message.createdAt);
      if (byTime != 0) return byTime;
      return a.identityKey.compareTo(b.identityKey);
    });
    history = List.unmodifiable(merged);
    _emit(generation);
  }

  Future<void> refreshHistory() async {
    if (!ready || _dead) return;
    final generation = _generation;
    try {
      await _refreshHistory(generation);
      if (_generation == generation) error = null;
    } catch (_) {
      if (_generation == generation) {
        error = 'Could not refresh history. Previously loaded messages are kept.';
        _emit(generation);
      }
    }
  }

  Future<void> switchTo(AssistantRole role) async {
    if (_dead || busy || !ready || activeRole == role) return;
    // An unknown send is reconciled before modifying the persona context.
    if (pending != null) {
      error = 'Resolve your pending message before switching assistants.';
      notifyListeners();
      return;
    }
    final generation = _generation;
    busy = true;
    error = null;
    _emit(generation);
    try {
      final target = roster[role]!;
      await directory.setDefaultPlatformAgent(target.characterId);
      if (_generation != generation || _dead) return;
      // Never assume a successful HTTP status committed the user's selection.
      final refreshed = _validateRoster(await directory.loadDirectory());
      if (_generation != generation || _dead) return;
      if (refreshed[role]?.defaultPlatformAgent != true) {
        throw StateError('Agent preference was not confirmed');
      }
      roster = refreshed;
      activeRole = role;
      notice = 'Assistant switched to ' + role.label + '.';
    } catch (_) {
      if (_generation == generation && !_dead) {
        error = 'Could not confirm the switch. Previous assistant retained.';
      }
    } finally {
      if (_generation == generation && !_dead) {
        busy = false;
        _emit(generation);
      }
    }
  }

  Future<void> sendText(String raw) async {
    final text = raw.trim();
    if (!canSend || text.isEmpty) return;
    if (text.length > 6000) {
      error = 'Message is too long.';
      notifyListeners();
      return;
    }
    final generation = _generation;
    busy = true; // Reserve send before the first asynchronous journal write.
    error = null;
    _emit(generation);
    final role = activeRole!;
    final turn = AssistantPendingTurn(
        characterId: roster[role]!.characterId,
        role: role,
        requestId: createRequestId(),
        text: text);
    // Durable journal must succeed before attempting a network side effect.
    try {
      await journal.write(_ownerId, turn);
    } catch (_) {
      if (_generation == generation && !_dead) {
        busy = false;
        error = 'Protected storage is unavailable; message was not sent.';
        _emit(generation);
      }
      return;
    }
    if (_generation != generation || _dead) return;
    pending = turn;
    busy = false;
    _emit(generation);
    await retryPending();
  }

  Future<void> retryPending() async {
    final turn = pending;
    if (_dead || busy || turn == null ||
        roster[turn.role]?.characterId != turn.characterId) return;
    final generation = _generation;
    busy = true;
    error = null;
    notice = null;
    _emit(generation);
    try {
      // Reconcile before resending. Status is independently server-owned.
      final status = await shell.turnStatus(turn.characterId, turn.requestId);
      if (_generation != generation || _dead) return;
      if (status.state == 'completed') {
        await _acknowledged(turn, generation);
        return;
      }
      if (status.state == 'pending') {
        notice = 'Assistant is still processing this message.';
        return;
      }
      if (status.state == 'failed') {
        error = 'The previous request failed. Discard it before sending anew.';
        return;
      }
      if (status.state != 'missing') {
        throw const FormatException('Unrecognized status');
      }

      // If the earlier attempt timed out, reuse exactly the same requestId.
      var binding = _bindings[turn.characterId];
      binding ??= await agents.openSession(turn.characterId);
      if (_generation != generation || _dead) return;
      _bindings[turn.characterId] = binding;
      await agents.sendTurn(
          binding: binding, text: turn.text, requestId: turn.requestId);
      if (_generation != generation || _dead) return;
      await _acknowledged(turn, generation);
    } catch (_) {
      if (_generation == generation && !_dead) {
        // A server session can expire during an outage. The next retry
        // rechecks authoritative status, then opens a fresh admitted session
        // while preserving the original idempotency key.
        _bindings.remove(turn.characterId);
        error = 'Delivery is uncertain. Retry checks the same request ID.';
      }
    } finally {
      if (_generation == generation && !_dead) {
        busy = false;
        _emit(generation);
      }
    }
  }

  Future<void> _acknowledged(AssistantPendingTurn turn, int generation) async {
    await journal.clear(_ownerId);
    if (_generation != generation || _dead) return;
    pending = null;
    notice = 'Server acknowledged your message.';
    try {
      await _refreshHistory(generation);
    } catch (_) {
      if (_generation == generation && !_dead) {
        notice = 'Sent; history will refresh when connectivity returns.';
      }
    }
  }

  /// Only a conscious user action can abandon an uncertain request. An earlier
  /// already-running server turn is not cancelled or fabricated as failed.
  Future<void> dismissPending() async {
    if (_dead || busy || pending == null) return;
    final generation = _generation;
    try {
      await journal.clear(_ownerId);
      if (_generation != generation || _dead) return;
      pending = null;
      notice = 'Local retry removed. Check history before resending.';
      error = null;
      _emit(generation);
    } catch (_) {
      if (_generation == generation) {
        error = 'Could not clear pending operation securely.';
        _emit(generation);
      }
    }
  }

  @override
  void dispose() {
    ++_generation;
    _dead = true;
    _bindings.clear();
    super.dispose();
  }
}
