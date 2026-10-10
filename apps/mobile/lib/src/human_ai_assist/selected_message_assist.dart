import 'package:flutter/foundation.dart';

/// The U08 feature is invoked from a human DM selection, never the private AI
/// conversation itself. Only IDs are sent to the Gateway; raw messages are never
/// extracted from an offline cache for a model.
enum HumanAiAssistPurpose { reply, translate, prepareTalk }

extension HumanAiAssistPurposeWire on HumanAiAssistPurpose {
  String get wire => switch (this) {
    HumanAiAssistPurpose.reply => 'reply',
    HumanAiAssistPurpose.translate => 'translate',
    HumanAiAssistPurpose.prepareTalk => 'prepare_talk',
  };
}

class HumanAiPreview {
  const HumanAiPreview({
    required this.text, required this.purpose, required this.peerUserId,
    required this.expiresAt, this.reviewToken,
  });
  final String text, peerUserId;
  final DateTime expiresAt;
  final HumanAiAssistPurpose purpose;
  final String? reviewToken;
}

abstract class HumanAiAssistTransport {
  Future<HumanAiPreview> prepare({
    required String conversationId,
    required List<String> messageIds,
    required HumanAiAssistPurpose purpose,
    required String language,
    required bool maskPrivateNumbers,
  });
  Future<String> sendReviewed({
    required String reviewToken,
    required String recipientUserId,
    required String reviewedBody,
  });
}

enum HumanAiAssistPhase { choose, preparing, review, sending, sent, uncertain }

/// Small explicit state machine: no model or network access before a disclosure
/// checkbox, and no dispatch before a SECOND recipient/wording confirmation.
/// Session/account changes revoke the in-memory token immediately.
class SelectedMessageAssistController extends ChangeNotifier {
  SelectedMessageAssistController({
    required this.transport,
    required this.conversationId,
    required this.messageIds,
    required this.recipientUserId,
    required this.accountKey,
  }) : assert(messageIds.isNotEmpty && messageIds.length <= 3);

  final HumanAiAssistTransport transport;
  final String conversationId, recipientUserId;
  final List<String> messageIds;
  String accountKey;
  HumanAiAssistPhase phase = HumanAiAssistPhase.choose;
  HumanAiPreview? preview;
  String? error;
  String? sentMessageId;
  String reviewedText = '';
  int _epoch = 0;
  bool _closed = false;

  bool get busy => phase == HumanAiAssistPhase.preparing || phase == HumanAiAssistPhase.sending;
  bool get canSend => phase == HumanAiAssistPhase.review &&
      preview?.purpose == HumanAiAssistPurpose.reply &&
      preview?.peerUserId == recipientUserId &&
      preview?.reviewToken != null && reviewedText.trim().isNotEmpty &&
      DateTime.now().isBefore(preview!.expiresAt);

  void changeReviewedText(String text) {
    if (_closed || phase != HumanAiAssistPhase.review) return;
    reviewedText = text;
    notifyListeners();
  }

  void clearSession(String newAccountKey) {
    if (_closed) return;
    accountKey = newAccountKey;
    _epoch++;
    phase = HumanAiAssistPhase.choose;
    preview = null;
    reviewedText = '';
    error = null;
    sentMessageId = null;
    notifyListeners();
  }

  Future<void> prepare({
    required HumanAiAssistPurpose purpose,
    required String language,
    required bool disclosureAccepted,
    required bool maskPrivateNumbers,
  }) async {
    if (_closed || busy || !disclosureAccepted) {
      if (!_closed && !disclosureAccepted) {
        error = 'Review and accept what will be shared with your Assistant.';
        notifyListeners();
      }
      return;
    }
    final epoch = ++_epoch;
    phase = HumanAiAssistPhase.preparing;
    preview = null; sentMessageId = null; error = null; reviewedText = '';
    notifyListeners();
    try {
      final next = await transport.prepare(
        conversationId: conversationId, messageIds: List.unmodifiable(messageIds),
        purpose: purpose, language: language, maskPrivateNumbers: maskPrivateNumbers,
      );
      if (_closed || epoch != _epoch) return;
      if (next.peerUserId != recipientUserId || next.purpose != purpose) {
        throw const FormatException('Selected message authorization changed');
      }
      preview = next;
      reviewedText = next.text;
      phase = HumanAiAssistPhase.review;
    } catch (_) {
      if (_closed || epoch != _epoch) return;
      phase = HumanAiAssistPhase.choose;
      error = 'Could not securely prepare this selection. Refresh the conversation.';
    }
    notifyListeners();
  }

  Future<void> send({required bool recipientAndTextConfirmed}) async {
    if (_closed || !recipientAndTextConfirmed || !canSend || busy) {
      if (!_closed && !recipientAndTextConfirmed) {
        error = 'Confirm the recipient and exact message before sending.';
        notifyListeners();
      }
      return;
    }
    final epoch = ++_epoch;
    phase = HumanAiAssistPhase.sending; error = null; notifyListeners();
    try {
      // If the response is lost, keep the token AND exact edited body for a
      // safe same-ID retry. The server/C02 own authoritative send status.
      final result = await transport.sendReviewed(
        reviewToken: preview!.reviewToken!, recipientUserId:recipientUserId,
        reviewedBody:reviewedText,
      );
      if (_closed || epoch != _epoch) return;
      sentMessageId = result;
      phase = HumanAiAssistPhase.sent;
    } catch (_) {
      if (_closed || epoch != _epoch) return;
      phase = HumanAiAssistPhase.uncertain;
      error = 'Send not confirmed. Check the conversation before retrying.';
    }
    notifyListeners();
  }

  /// Retry uses the same server-issued nonce and reviewed body.
  Future<void> retryUncertain({required bool recipientAndTextConfirmed}) async {
    if (_closed || phase != HumanAiAssistPhase.uncertain || !recipientAndTextConfirmed ||
        preview?.reviewToken == null || DateTime.now().isAfter(preview!.expiresAt)) {
      return;
    }
    phase = HumanAiAssistPhase.review;
    notifyListeners();
    await send(recipientAndTextConfirmed:true);
  }

  void discard() { clearSession(accountKey); }

  @override
  void dispose() { _closed = true; _epoch++; super.dispose(); }
}
