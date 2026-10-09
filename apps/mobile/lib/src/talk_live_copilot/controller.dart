import 'dart:math';

import 'package:flutter/foundation.dart';

import 'models.dart';

/**
 * Ephemeral, account-scoped Host controls. No background/autonomous stage
 * generation. An uncertain HTTP response retains the SAME request ID.
 */
class HostCopilotController extends ChangeNotifier {
  HostCopilotController({required this.transport});
  final HostCopilotTransport transport;
  String? _scope;
  String? _talkId;
  String? _seatId;
  int _epoch = 0;
  bool _closed = false;
  bool busy = false;
  String? error;
  List<HostCopilotSuggestion> suggestions = const [];
  HostCopilotTurnReceipt? lastReceipt;
  String? _pendingRequestId;
  String? _pendingTranscript;

  bool get blockedOnUnknown =>
      lastReceipt?.status == HostCopilotStatus.uncertain ||
      lastReceipt?.status == HostCopilotStatus.inProgress;

  void openScope({
    required String accountSessionKey,
    required String talkId,
    required String seatId,
  }) {
    if (_closed) return;
    if (accountSessionKey.trim().isEmpty ||
        talkId.trim().isEmpty || seatId.trim().isEmpty) {
      throw ArgumentError('A verified Host session and Talk/Seat are required');
    }
    final next = '$accountSessionKey|$talkId|$seatId';
    if (_scope == next) return;
    _epoch++;
    _scope = next;
    _talkId = talkId;
    _seatId = seatId;
    busy = false;
    error = null;
    suggestions = const [];
    lastReceipt = null;
    _pendingRequestId = null;
    _pendingTranscript = null;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (_scope == null || busy || _closed) return;
    final epoch = _epoch;
    final talkId = _talkId!;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final next = await transport.suggestions(talkId);
      if (epoch != _epoch || _closed) return;
      suggestions = List.unmodifiable(next.take(3));
    } catch (_) {
      if (epoch != _epoch || _closed) return;
      error = 'Suggestions unavailable. Check your connection and Host access.';
    } finally {
      if (epoch == _epoch && !_closed) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> approve(String transcript) async {
    if (_scope == null || busy || blockedOnUnknown || _closed) return;
    if (transcript.trim().isEmpty || transcript.trim().length > 500) {
      error = 'Review a question of up to 500 characters.';
      notifyListeners();
      return;
    }
    final text = transcript.trim();
    // Reuse exactly the same idempotency key after a lost HTTP ACK.
    if (_pendingRequestId != null && _pendingTranscript != text) {
      error = 'Resolve the previous uncertain request before changing the question.';
      notifyListeners();
      return;
    }
    _pendingRequestId ??= _newRequestId();
    _pendingTranscript ??= text;
    final requestId = _pendingRequestId!;
    final epoch = _epoch;
    final talkId = _talkId!, seatId = _seatId!;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final receipt = await transport.approveTurn(
        talkId: talkId, seatId: seatId, requestId: requestId,
        hostApprovedTranscript: text,
      );
      if (epoch != _epoch || _closed) return;
      lastReceipt = receipt;
      // Treat published as the server's *dispatch* acknowledgement only.
      if (receipt.status == HostCopilotStatus.published ||
          receipt.status == HostCopilotStatus.denied ||
          receipt.status == HostCopilotStatus.budgetExhausted ||
          receipt.status == HostCopilotStatus.conflict) {
        _pendingRequestId = null;
        _pendingTranscript = null;
      }
    } catch (_) {
      if (epoch != _epoch || _closed) return;
      error = 'Turn status unknown. Retry the same request; do not start another.';
    } finally {
      if (epoch == _epoch && !_closed) {
        busy = false;
        notifyListeners();
      }
    }
  }

  static String _newRequestId() {
    final secure = Random.secure();
    final bytes = List<int>.generate(16, (_) => secure.nextInt(256));
    return 'host-' + bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  @override
  void dispose() {
    _epoch++;
    _closed = true;
    _scope = null;
    _talkId = null;
    _seatId = null;
    _pendingRequestId = null;
    _pendingTranscript = null;
    super.dispose();
  }
}
