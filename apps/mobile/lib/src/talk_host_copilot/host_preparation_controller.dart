import 'package:flutter/foundation.dart';

import 'host_preparation.dart';

/// All remote responses are fenced to the signed-in account and current operation.
/// No auto-create, auto-publish, or implicit financial confirmation.
class HostPreparationController extends ChangeNotifier {
  HostPreparationController({
    required HostPreparationTransport transport,
    required String accountKey,
  }) : _transport = transport, _accountKey = accountKey;

  final HostPreparationTransport _transport;
  String _accountKey;
  int _generation = 0;
  bool _disposed = false;
  bool busy = false;
  String? error;
  HostPreparation? draft;

  bool get mayGoLive => !busy && draft?.phase == HostPreparationPhase.draft;

  void switchAccount(String accountKey) {
    if (_accountKey == accountKey) return;
    _generation++;
    _accountKey = accountKey;
    draft = null;
    error = null;
    busy = false;
    notifyListeners();
  }

  Future<void> create({
    required String title, required String topic, required List<String> questions,
  }) => _run(() => _transport.create(title: title, topic: topic, questions: questions));

  Future<void> load(String prepId) => _run(() => _transport.read(prepId));

  Future<void> save({
    required String title, required String topic, required List<String> questions,
  }) async {
    final current = draft;
    if (current == null || current.phase != HostPreparationPhase.draft) return;
    await _run(() => _transport.edit(
      prepId: current.prepId, revision: current.revision,
      title: title, topic: topic, questions: questions,
    ));
  }

  /// Caller MUST present a human-reviewed confirmation; no other method calls this.
  Future<void> goLiveAfterReview() async {
    final current = draft;
    if (current == null || current.phase != HostPreparationPhase.draft) return;
    await _run(() => _transport.goLive(current.prepId, current.revision));
  }

  Future<void> verifyPublication() async {
    final current = draft;
    if (current == null) return;
    await _run(() => _transport.verify(current.prepId));
  }

  Future<void> _run(Future<HostPreparation> Function() action) async {
    if (busy || _disposed) return;
    final turn = ++_generation;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final received = await action();
      if (!_disposed && turn == _generation) draft = received;
    } catch (e) {
      if (!_disposed && turn == _generation) error = hostPreparationError(e);
    } finally {
      if (!_disposed && turn == _generation) {
        busy = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    super.dispose();
  }
}
