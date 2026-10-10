import 'package:flutter/foundation.dart';

import '../core/request_id.dart';
import 'human_chat_contract.dart';

/// One conversation and one verified account. The composition owner must
/// dispose it on logout, tenant switch, membership revoke and account change.
/// isAuthorized rechecks the LIVE session; a stale widget cannot send.
class HumanChatComposerController extends ChangeNotifier {
  HumanChatComposerController({
    required this.scope,
    required this.drafts,
    required this.sender,
    required this.isAuthorized,
  }) {
    if (!scope.valid) throw ArgumentError('Invalid human conversation');
  }

  final HumanChatScope scope;
  final HumanChatDraftStore drafts;
  final HumanChatSendPort sender;
  final bool Function(HumanChatScope) isAuthorized;

  bool hydrated = false;
  bool sending = false;
  bool _disposed = false;
  bool _revoked = false;
  String text = '';
  String? pendingRequestId;
  String? pendingText;
  String? pendingReplyToMessageId;
  String? error;
  String? lastServerAcceptedMessageId;
  HumanChatReplyQuote? quote;
  Future<void> _writes = Future<void>.value();

  bool get active => !_disposed && !_revoked && isAuthorized(scope);
  bool get hasPending => pendingRequestId != null;
  bool get canEdit => hydrated && active && !_storageUnavailable &&
      !sending && !hasPending;
  bool get canSubmit => hydrated && active && !_storageUnavailable && !sending &&
      (hasPending || text.trim().isNotEmpty);

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  HumanChatDraft _snapshot() => HumanChatDraft(
    text: text,
    pendingRequestId: pendingRequestId,
    pendingText: pendingText,
    pendingReplyToMessageId: pendingReplyToMessageId,
  );

  /// Writes from typing/send are serialized, so slow earlier writes cannot
  /// resurrect old drafts after an acknowledged send.
  Future<void> _persist(HumanChatDraft snapshot) {
    final next = _writes.then((_) async {
      if (!active) return;
      await drafts.write(scope, snapshot);
    });
    _writes = next.catchError((Object _) {});
    return next;
  }

  Future<void> load() async {
    if (hydrated || _disposed) return;
    try {
      final value = await drafts.read(scope);
      if (!active) return;
      text = value?.text ?? '';
      pendingRequestId = value?.pendingRequestId;
      pendingText = value?.pendingText;
      pendingReplyToMessageId = value?.pendingReplyToMessageId;
      error = hasPending
          ? 'Delivery unconfirmed. Retry using the same message ID.'
          : null;
    } catch (_) {
      if (!active) return;
      // Do not erase corrupt/temporarily inaccessible secure storage.
      error = 'Secure drafts unavailable. Sending is disabled.';
      _storageUnavailable = true;
    } finally {
      if (active) {
        hydrated = true;
        _notify();
      }
    }
  }

  bool _storageUnavailable = false;

  void updateText(String next) {
    if (!hydrated || !active || _storageUnavailable ||
        next.length > 4000 || hasPending) return;
    text = next;
    error = null;
    lastServerAcceptedMessageId = null;
    _notify();
    _persist(_snapshot()).catchError((Object _) {
      if (active) {
        _storageUnavailable = true;
        error = 'Unable to protect draft. Sending is disabled.';
        _notify();
      }
    });
  }

  void setQuote(HumanChatReplyQuote? next) {
    if (!active || !sender.supportsReply || hasPending) return;
    quote = (next?.available == true) ? next : null;
    _notify();
  }

  /// Parent should call when a selected message changes/deletes/revokes.
  void invalidateQuote(String messageId) {
    if (quote?.messageId == messageId) {
      quote = null;
      _notify();
    }
  }

  Future<bool> submit() async {
    if (!canSubmit || _storageUnavailable) return false;
    final body = hasPending ? pendingText! : text.trim();
    if (body.isEmpty || body.length > 4000) return false;
    sending = true;
    error = null;
    lastServerAcceptedMessageId = null;
    var networkAttempted = false;
    _notify();
    try {
      if (!hasPending) {
        final activeQuote = sender.supportsReply && quote?.available == true
            ? quote
            : null;
        pendingRequestId = createRequestId();
        pendingText = body;
        pendingReplyToMessageId = activeQuote?.messageId;
      }
      // Durability-before-execution: never call C02 if we cannot safely retry.
      await _persist(_snapshot());
      if (!active) return false;
      final expectedId = pendingRequestId!;
      networkAttempted = true;
      final ack = await sender.send(
        scope: scope,
        clientRequestId: expectedId,
        text: pendingText!,
        replyToMessageId: pendingReplyToMessageId,
      );
      if (!active) return false;
      if (ack.conversationId != scope.conversationId ||
          ack.clientRequestId != expectedId || ack.messageId.isEmpty) {
        throw const FormatException('Mismatched server acknowledgement');
      }
      lastServerAcceptedMessageId = ack.messageId;
      if (text.trim() == pendingText) text = '';
      pendingRequestId = null;
      pendingText = null;
      pendingReplyToMessageId = null;
      quote = null;
      try {
        await _persist(_snapshot());
      } catch (_) {
        // The C02 response was accepted. Do not describe an accepted
        // server message as unsent if local cleanup subsequently fails.
        _storageUnavailable = true;
        error = 'Server accepted the message, but draft cleanup failed.';
      }
      return true;
    } catch (_) {
      if (active) {
        if (!networkAttempted) _storageUnavailable = true;
        error = networkAttempted
            ? 'Not confirmed by server. Retry the SAME message; do not retype.'
            : 'Not sent: secure draft could not be saved.';
      }
      return false;
    } finally {
      sending = false;
      _notify();
    }
  }

  /// Discard is explicit: a timed-out send may still reach C02. Do not
  /// silently create a replacement request ID.
  Future<void> discardUnconfirmed() async {
    if (!active || sending || !hasPending) return;
    pendingRequestId = null;
    pendingText = null;
    pendingReplyToMessageId = null;
    error = null;
    await _persist(_snapshot());
    _notify();
  }

  /// The session owner must purge account data before replacing the session.
  Future<void> purgeAccount() async {
    if (_disposed) return;
    // Revoke FIRST so late sends cannot rewrite drafts after deletion.
    _revoked = true;
    text = '';
    pendingRequestId = null;
    pendingText = null;
    pendingReplyToMessageId = null;
    quote = null;
    error = null;
    lastServerAcceptedMessageId = null;
    _notify(); // hide previous account's private content synchronously
    await _writes;
    await drafts.clearAccount(scope.tenantId, scope.userId);
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
