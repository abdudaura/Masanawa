import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'human_chat_draft_store.dart';

/// C02 server acknowledgement only; never infer remote delivery/read.
class HumanChatAccepted {
  const HumanChatAccepted({required this.messageId, required this.clientRequestId});
  final String messageId, clientRequestId;
}

/// Adapter to the canonical C02 HumanDmTransport. The integrating owner
/// supplies authenticated history/search (not local optimistic state) and send.
abstract class HumanChatSendPort {
  Future<HumanChatAccepted?> findServerAcknowledgement(
      String conversationId, String clientRequestId);
  Future<HumanChatAccepted> send(
      String conversationId, String clientRequestId, String body,
      {String? replyToMessageId});
}

String newHumanChatRequestId() {
  final secure = Random.secure();
  return base64UrlEncode(
    List<int>.generate(24, (_) => secure.nextInt(256)),
  ).replaceAll('=', '');
}

enum HumanChatPhase { ready, sending, uncertain }

/// Must be rebuilt whenever account/tenant/conversation or auth session changes.
class HumanChatComposerController extends ChangeNotifier {
  HumanChatComposerController({
    required this.tenantId, required this.userId, required this.conversationId,
    required this.drafts, required this.messages,
    this.serverSupportsReplies = false, String Function()? requestIds,
  }) : _requestIds = requestIds ?? newHumanChatRequestId,
       key = humanDraftKey(tenantId, userId, conversationId);

  final String tenantId, userId, conversationId, key;
  final HumanChatDraftStore drafts;
  final HumanChatSendPort messages;
  final bool serverSupportsReplies;
  final String Function() _requestIds;
  Future<void> _writes = Future<void>.value();
  bool loading = true, allowed = true, _disposed = false;
  int _generation = 0;
  String text = '';
  String? replyId, replyPreview, pendingId, pendingBody, pendingReplyId, notice;
  HumanChatPhase phase = HumanChatPhase.ready;

  bool get hasPending => pendingId != null;
  bool get canSend => !loading && allowed && !hasPending &&
      text.trim().isNotEmpty && text.trim().length <= 4000;
  bool get canRetry => !loading && allowed && hasPending &&
      (pendingReplyId == null || serverSupportsReplies) &&
      phase != HumanChatPhase.sending;

  void _emit() { if (!_disposed) notifyListeners(); }
  HumanChatDraft get _snapshot => HumanChatDraft(
    text: text, replyId: replyId, replyPreview: replyPreview,
    pendingId: pendingId, pendingBody: pendingBody,
    pendingReplyId: pendingReplyId,
  );

  Future<void> _save() {
    final snapshot = _snapshot;
    final next = _writes.then((_) async {
      if (snapshot.text.isEmpty && !snapshot.uncertain &&
          snapshot.replyId == null) {
        await drafts.remove(key);
      } else {
        await drafts.write(key, snapshot);
      }
    });
    _writes = next.then((_) {}, onError: (Object _, StackTrace __) {});
    return next;
  }

  void _saveEdit() {
    unawaited(_save().catchError((Object _) {
      notice = 'Protected draft could not be saved.';
      _emit();
    }));
  }

  Future<void> restore() async {
    if (_disposed) return;
    final epoch = ++_generation;
    loading = true; _emit();
    try {
      await _writes;
      final saved = await drafts.read(key);
      if (_disposed || epoch != _generation) return;
      if (saved != null) {
        text = saved.text;
        pendingId = saved.pendingId;
        pendingBody = saved.pendingBody;
        replyId = serverSupportsReplies ? saved.replyId : null;
        replyPreview = serverSupportsReplies ? saved.replyPreview : null;
        pendingReplyId = saved.pendingReplyId;
        // An old pending reply cannot silently turn into an ordinary send.
        if (pendingReplyId != null && !serverSupportsReplies) {
          notice = 'Reply support changed. Do not retry this pending message.';
        }
        phase = hasPending ? HumanChatPhase.uncertain : HumanChatPhase.ready;
        if (hasPending && pendingReplyId == null) {
          notice = 'Unconfirmed send recovered. Check before retry.';
        }
      }
    } catch (_) {
      if (!_disposed && epoch == _generation) {
        allowed = false;
        notice = 'Protected chat draft unavailable. Reopen when storage recovers.';
      }
    } finally {
      if (!_disposed && epoch == _generation) { loading = false; _emit(); }
    }
  }

  void edit(String value) {
    if (_disposed || loading || hasPending || !allowed || value.length > 4000) return;
    text = value; notice = null; _emit(); _saveEdit();
  }

  void selectReply(String messageId, String preview, {required bool isAvailable}) {
    if (!serverSupportsReplies || !isAvailable || hasPending || loading ||
        !allowed || messageId.isEmpty || messageId.length > 128) return;
    replyId = messageId;
    replyPreview = preview.length > 180 ? preview.substring(0, 180) : preview;
    _emit(); _saveEdit();
  }

  void clearReply() {
    if (hasPending || loading) return;
    replyId = null; replyPreview = null; _emit(); _saveEdit();
  }

  /// Revoke on C01 block/revoke/logout; backend must also enforce membership.
  void setPermission(bool value) {
    allowed = value;
    if (!value) notice = 'Messaging permission was revoked.';
    _emit();
  }

  Future<bool> submit() async {
    if (_disposed || !canSend) return false;
    final id = _requestIds();
    if (id.isEmpty || id.length > 128) {
      notice = 'Could not prepare a message ID.'; _emit(); return false;
    }
    pendingId = id; pendingBody = text.trim();
    pendingReplyId = serverSupportsReplies ? replyId : null;
    phase = HumanChatPhase.uncertain;
    try {
      // Persist exact request ID BEFORE making a side-effecting API call.
      await _save();
    } catch (_) {
      pendingId = null; pendingBody = null; pendingReplyId = null;
      phase = HumanChatPhase.ready;
      notice = 'Secure storage unavailable. No message was sent.';
      _emit(); return false;
    }
    return _attempt();
  }

  Future<bool> retry() async {
    if (!canRetry || _disposed) return false;
    return _attempt();
  }

  Future<bool> _attempt() async {
    if (_disposed || !allowed || !hasPending ||
        (pendingReplyId != null && !serverSupportsReplies) ||
        phase == HumanChatPhase.sending) {
      return false;
    }
    final epoch = _generation, id = pendingId!, body = pendingBody!;
    phase = HumanChatPhase.sending; notice = null; _emit();
    try {
      final existing = await messages.findServerAcknowledgement(conversationId, id);
      if (_disposed || epoch != _generation) return false;
      if (!allowed) {
        phase = HumanChatPhase.uncertain;
        notice = 'Messaging permission changed. Server send not attempted.';
        _emit(); return false;
      }
      if (existing != null) return _ack(existing, id);
      final accepted = await messages.send(conversationId, id, body,
          replyToMessageId: pendingReplyId);
      if (_disposed || epoch != _generation) return false;
      return _ack(accepted, id);
    } catch (_) {
      if (!_disposed && epoch == _generation) {
        phase = HumanChatPhase.uncertain;
        notice = 'Send not confirmed. Retry will reuse the same request ID.';
        _emit();
      }
      return false;
    }
  }

  Future<bool> _ack(HumanChatAccepted accepted, String expectedId) async {
    if (accepted.clientRequestId != expectedId || accepted.messageId.isEmpty) {
      phase = HumanChatPhase.uncertain;
      notice = 'Server acknowledgement could not be verified.';
      _emit(); return false;
    }
    final old = _snapshot;
    text = ''; replyId = null; replyPreview = null;
    pendingId = null; pendingBody = null; pendingReplyId = null;
    text = ''; replyId = null; replyPreview = null;
    try {
      await _save();
    } catch (_) {
      text = old.text; replyId = old.replyId; replyPreview = old.replyPreview;
      pendingId = old.pendingId; pendingBody = old.pendingBody;
      pendingReplyId = old.pendingReplyId;
      phase = HumanChatPhase.uncertain;
      notice = 'Server accepted this send, but draft cleanup failed. Recheck.';
      _emit(); return false;
    }
    phase = HumanChatPhase.ready;
    notice = 'Accepted by server; delivery and read not confirmed.';
    _emit();
    return true;
  }

  /// UI must warn: server may already have received an uncertain send.
  Future<bool> abandonUnconfirmed() async {
    if (_disposed || !hasPending || phase == HumanChatPhase.sending) return false;
    final old = _snapshot;
    pendingId = null; pendingBody = null; pendingReplyId = null;
    try {
      await _save();
    } catch (_) {
      pendingId = old.pendingId; pendingBody = old.pendingBody;
      pendingReplyId = old.pendingReplyId;
      text = old.text; replyId = old.replyId; replyPreview = old.replyPreview;
      notice = 'Could not update protected pending message.'; _emit();
      return false;
    }
    phase = HumanChatPhase.ready;
    notice = 'Removed locally; a previous send might have arrived.';
    _emit(); return true;
  }

  /// Called by the session coordinator on logout, account erasure, or revoke.
  /// Any request already admitted by C02 may still resolve server-side, but
  /// its stale response cannot populate a different account's composer.
  Future<void> revokeSessionAndPurge() async {
    if (_disposed) return;
    ++_generation;
    allowed = false;
    loading = true;
    _emit();
    try {
      await _writes;
      await drafts.remove(key);
      text = ''; replyId = null; replyPreview = null;
      pendingId = null; pendingBody = null; pendingReplyId = null;
      phase = HumanChatPhase.ready;
      notice = 'This private chat draft was cleared on sign-out.';
    } catch (_) {
      notice = 'Draft purge failed. Keep account locked until storage is cleared.';
    } finally {
      if (!_disposed) { loading = false; _emit(); }
    }
  }

  @override
  void dispose() {
    _generation++; _disposed = true;
    super.dispose();
  }
}
