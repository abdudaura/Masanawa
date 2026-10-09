import 'package:flutter/foundation.dart';

enum TalkInsightStatus { processing, ready, failed }

class TalkInsightDraft {
  const TalkInsightDraft({
    required this.talkId,
    required this.recordingId,
    required this.status,
    required this.updatedAt,
    this.summary,
    this.highlights = const [],
    this.nextTalkTitle,
  });
  final String talkId;
  final String recordingId;
  final TalkInsightStatus status;
  final DateTime updatedAt;
  final String? summary;
  final List<String> highlights;
  final String? nextTalkTitle;

  factory TalkInsightDraft.fromJson(Map<String, dynamic> json) {
    final status = switch (json['status']) {
      'processing' => TalkInsightStatus.processing,
      'ready' => TalkInsightStatus.ready,
      'failed' => TalkInsightStatus.failed,
      _ => throw const FormatException('Invalid insights state'),
    };
    final talkId = json['talkId'];
    final recordingId = json['recordingId'];
    final date = DateTime.tryParse(json['updatedAt'] as String? ?? '');
    final rawHighlights = json['highlights'];
    if (talkId is! String || talkId.isEmpty || recordingId is! String ||
        recordingId.isEmpty || date == null ||
        rawHighlights is! List || rawHighlights.length > 6 ||
        rawHighlights.any((item) => item is! String || item.length > 300) ||
        (json['summary'] != null &&
            (json['summary'] is! String ||
             (json['summary'] as String).length > 2400)) ||
        (json['nextTalkTitle'] != null &&
            (json['nextTalkTitle'] is! String ||
             (json['nextTalkTitle'] as String).length > 120))) {
      throw const FormatException('Invalid insights response');
    }
    return TalkInsightDraft(
      talkId: talkId, recordingId: recordingId, updatedAt: date,
      status: status, summary: status == TalkInsightStatus.ready ? json['summary'] as String? : null,
      highlights: status == TalkInsightStatus.ready ? List<String>.unmodifiable(rawHighlights.cast<String>()) : const [],
      nextTalkTitle: status == TalkInsightStatus.ready ? json['nextTalkTitle'] as String? : null,
    );
  }
}

abstract interface class TalkInsightTransport {
  Future<TalkInsightDraft?> read(String talkId);
  Future<TalkInsightDraft> generate(String talkId);
}

enum TalkInsightUiState { idle, loading, unavailable, processing, ready, failed }

/// Never caches private insight content between accounts or across app restarts.
class TalkInsightController extends ChangeNotifier {
  TalkInsightController({
    required this.transport, required this.activeOwnerId,
    required this.talkId, required String ownerId,
  }) : _ownerId = ownerId;

  final TalkInsightTransport transport;
  final String? Function() activeOwnerId;
  final String talkId;
  String _ownerId;
  int _epoch = 0;
  bool _disposed = false;
  TalkInsightUiState state = TalkInsightUiState.idle;
  TalkInsightDraft? draft;
  String? errorMessage;
  bool _busy = false;

  bool get isCurrentOwner => _ownerId.isNotEmpty && activeOwnerId() == _ownerId;
  void resetOwner(String ownerId) {
    _epoch++;
    _ownerId = ownerId;
    draft = null;
    errorMessage = null;
    state = TalkInsightUiState.idle;
    if (!_disposed) notifyListeners();
  }
  void _publish(int epoch, TalkInsightDraft? next) {
    if (_disposed || epoch != _epoch || !isCurrentOwner) return;
    draft = next;
    state = next == null ? TalkInsightUiState.unavailable :
      switch (next.status) {
        TalkInsightStatus.processing => TalkInsightUiState.processing,
        TalkInsightStatus.ready => TalkInsightUiState.ready,
        TalkInsightStatus.failed => TalkInsightUiState.failed,
      };
    errorMessage = null;
    notifyListeners();
  }
  Future<void> refresh() => _run(() => transport.read(talkId));
  Future<void> generate({required bool explicitConsent}) async {
    if (!explicitConsent) {
      errorMessage = 'Consent is required to process the recorded Talk.';
      if (!_disposed) notifyListeners();
      return;
    }
    return _run(() => transport.generate(talkId));
  }
  Future<void> _run(Future<TalkInsightDraft?> Function() action) async {
    if (_disposed || _busy || !isCurrentOwner) return;
    final epoch = ++_epoch;
    _busy = true;
    state = TalkInsightUiState.loading;
    errorMessage = null;
    notifyListeners();
    try {
      final result = await action();
      if (result != null && result.talkId != talkId) {
        throw const FormatException('Mismatched Talk insight');
      }
      _publish(epoch, result);
    } catch (_) {
      if (!_disposed && epoch == _epoch && isCurrentOwner) {
        draft = null;
        state = TalkInsightUiState.failed;
        errorMessage = 'Insights are unavailable right now. Retry to check their status.';
        notifyListeners();
      }
    } finally {
      _busy = false;
    }
  }
  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    draft = null;
    super.dispose();
  }
}
