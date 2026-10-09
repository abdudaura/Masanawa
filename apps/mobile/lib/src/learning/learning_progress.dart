import 'package:flutter/foundation.dart';

/// Private, authenticated Study-mode readback. This is deliberately not a
/// second local progress database. Only a canonical server reply may advance
/// the checkpoint; the user's spoken/text answer never does.
@immutable
class LearningCheckpoint {
  const LearningCheckpoint({
    required this.topic,
    required this.goal,
    required this.level,
    required this.checkpoint,
    required this.nextStep,
    required this.masteryNotes,
    required this.updatedAt,
  });

  final String topic;
  final String goal;
  final String level;
  final String checkpoint;
  final String nextStep;
  final List<String> masteryNotes;
  final DateTime updatedAt;

  static String _field(Map<String, dynamic> json, String name, int max) {
    final raw = json[name];
    if (raw is! String || raw.trim().isEmpty || raw.length > max) {
      throw const FormatException('learning.invalid_progress');
    }
    return raw.trim();
  }

  factory LearningCheckpoint.fromJson(Map<String, dynamic> json) {
    final instant = DateTime.tryParse(json['updatedAt'] is String
        ? json['updatedAt'] as String
        : '');
    final notes = json['masteryNotes'];
    if (instant == null ||
        notes is! List ||
        notes.length > 24 ||
        notes.any((n) => n is! String || n.trim().isEmpty || n.length > 300)) {
      throw const FormatException('learning.invalid_progress');
    }
    return LearningCheckpoint(
      topic: _field(json, 'topic', 240),
      goal: _field(json, 'goal', 500),
      level: _field(json, 'level', 120),
      checkpoint: _field(json, 'checkpoint', 1000),
      nextStep: _field(json, 'nextStep', 1000),
      masteryNotes: List.unmodifiable(notes.cast<String>()),
      updatedAt: instant.toUtc(),
    );
  }
}

@immutable
class LearningReadback {
  const LearningReadback({required this.checkpoint});
  final LearningCheckpoint? checkpoint;

  factory LearningReadback.fromJson(Map<String, dynamic> json) {
    final state = json['state'];
    if (state == 'empty' && json['progress'] == null) {
      return const LearningReadback(checkpoint: null);
    }
    if (state != 'available' || json['progress'] is! Map) {
      throw const FormatException('learning.invalid_readback');
    }
    final content = (json['progress'] as Map).cast<String, dynamic>();
    return LearningReadback(checkpoint: LearningCheckpoint.fromJson(content));
  }
}

enum LearningAction {
  continueLesson('continue'),
  practice('practice'),
  explainAgain('explain_again'),
  simpler('simpler'),
  slower('slower'),
  answer('answer');

  const LearningAction(this.wireName);
  final String wireName;
}

@immutable
class LearningCommand {
  const LearningCommand({
    required this.action,
    required this.requestId,
    required this.expectedUpdatedAt,
    this.answer,
  });

  final LearningAction action;
  /// Server journal-owned idempotency key; do not mint a new key for retry.
  final String requestId;
  final String? expectedUpdatedAt;
  final String? answer;

  Map<String, dynamic> toJson() => {
        'action': action.wireName,
        'requestId': requestId,
        'expectedUpdatedAt': expectedUpdatedAt,
        if (answer != null) 'answer': answer,
      };
}

@immutable
class LearningActionOutcome {
  const LearningActionOutcome({
    required this.state,
    required this.latest,
    this.code,
  });
  final String state; // accepted, uncertain, rejected
  final LearningReadback latest;
  final String? code;

  factory LearningActionOutcome.fromJson(Map<String, dynamic> json) {
    final state = json['state'];
    if (state != 'accepted' && state != 'uncertain' && state != 'rejected') {
      throw const FormatException('learning.invalid_outcome');
    }
    if (json['latest'] is! Map) {
      throw const FormatException('learning.invalid_outcome');
    }
    return LearningActionOutcome(
      state: state as String,
      latest: LearningReadback.fromJson(
        (json['latest'] as Map).cast<String, dynamic>(),
      ),
      code: json['code'] is String ? json['code'] as String : null,
    );
  }
}

/// The implementing Gateway adapter must authenticate on each request,
/// authorize current relationship and use canonical task/turn idempotency.
abstract class LearningTransport {
  Future<LearningReadback> read({
    required String characterId,
    required String relationshipId,
  });

  Future<LearningActionOutcome> perform({
    required String characterId,
    required String relationshipId,
    required LearningCommand command,
  });
}

/// Key used here is an opaque authenticated session epoch, not a developer
/// token. A changed account/session purges A's private learning checkpoint.
class LearningProgressController extends ChangeNotifier {
  LearningProgressController({
    required LearningTransport transport,
    required String Function() issueRequestId,
    required String accountKey,
    required String characterId,
    required String relationshipId,
  })  : _transport = transport,
        _issueRequestId = issueRequestId,
        _accountKey = accountKey,
        _characterId = characterId,
        _relationshipId = relationshipId;

  final LearningTransport _transport;
  final String Function() _issueRequestId;
  String _accountKey;
  String _characterId;
  String _relationshipId;
  int _epoch = 0;
  int _sessionRevision = 0;
  bool _disposed = false;
  bool _busy = false;
  LearningCheckpoint? _checkpoint;
  String? _error;
  String? _lastActionState;

  bool get busy => _busy;
  int get sessionRevision => _sessionRevision;
  LearningCheckpoint? get checkpoint => _checkpoint;
  String? get error => _error;
  String? get lastActionState => _lastActionState;
  bool get needsReconciliation => _lastActionState == 'uncertain';

  void changeSession({
    required String accountKey,
    required String characterId,
    required String relationshipId,
  }) {
    if (_accountKey == accountKey &&
        _characterId == characterId &&
        _relationshipId == relationshipId) return;
    _epoch++;
    _sessionRevision++;
    _accountKey = accountKey;
    _characterId = characterId;
    _relationshipId = relationshipId;
    _busy = false;
    _checkpoint = null;
    _error = null;
    _lastActionState = null;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (_busy || _disposed) return;
    final generation = ++_epoch;
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      final readback = await _transport.read(
        characterId: _characterId,
        relationshipId: _relationshipId,
      );
      if (_disposed || generation != _epoch) return;
      _checkpoint = readback.checkpoint;
      // A fresh read alone does not reconcile an unknown dispatched operation.
    } catch (_) {
      if (_disposed || generation != _epoch) return;
      _error = 'Could not load learning progress. Try again.';
    } finally {
      if (!_disposed && generation == _epoch) {
        _busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> act(LearningAction action, {String? answer}) async {
    if (_busy || _disposed || needsReconciliation) return;
    if (action == LearningAction.answer &&
        (answer == null || answer.trim().isEmpty || answer.length > 2000)) {
      _error = 'Enter an answer before checking it.';
      notifyListeners();
      return;
    }
    final generation = ++_epoch;
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      // The request ID provider must retain uncertain keys in the canonical
      // task journal. No local retry is initiated on transport failure.
      final outcome = await _transport.perform(
        characterId: _characterId,
        relationshipId: _relationshipId,
        command: LearningCommand(
          action: action,
          requestId: _issueRequestId(),
          expectedUpdatedAt: _checkpoint?.updatedAt.toUtc().toIso8601String(),
          answer: action == LearningAction.answer ? answer!.trim() : null,
        ),
      );
      if (_disposed || generation != _epoch) return;
      _lastActionState = outcome.state;
      _checkpoint = outcome.latest.checkpoint;
      if (outcome.state == 'rejected') {
        _error = 'Study action was not accepted. Refresh and try again.';
      }
    } catch (_) {
      if (_disposed || generation != _epoch) return;
      _lastActionState = 'uncertain';
      _error = 'Study request status is unknown. Check its task before trying again.';
    } finally {
      if (!_disposed && generation == _epoch) {
        _busy = false;
        notifyListeners();
      }
    }
  }

  /// Called only after a *canonical* task/turn status confirms the old
  /// uncertain request is terminal; refreshing progress is not such proof.
  void acknowledgeReconciledTask() {
    if (_disposed || !needsReconciliation) return;
    _lastActionState = null;
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}
