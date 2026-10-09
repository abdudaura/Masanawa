import 'package:flutter/foundation.dart';

/// Human DMs only. IDs must come from the authenticated C01/C02 session, not
/// from an AI tool result, deep-link query or a public persona.
@immutable
class HumanChatScope {
  const HumanChatScope({
    required this.tenantId,
    required this.userId,
    required this.conversationId,
  });
  final String tenantId;
  final String userId;
  final String conversationId;

  bool get valid =>
      tenantId.trim().isNotEmpty &&
      userId.trim().isNotEmpty &&
      conversationId.trim().isNotEmpty;
}

/// Persisted before network I/O. Pending is an UNKNOWN server outcome until
/// the C02 authority acknowledges this exact request ID.
@immutable
class HumanChatDraft {
  const HumanChatDraft({
    this.text = '',
    this.pendingRequestId,
    this.pendingText,
    this.pendingReplyToMessageId,
  });
  final String text;
  final String? pendingRequestId;
  final String? pendingText;
  final String? pendingReplyToMessageId;

  bool get hasPending => pendingRequestId != null;

  Map<String, Object?> toJson() => {
        'text': text,
        'pendingRequestId': pendingRequestId,
        'pendingText': pendingText,
        'pendingReplyToMessageId': pendingReplyToMessageId,
      };

  factory HumanChatDraft.fromJson(Map<String, dynamic> json) {
    final text = json['text'];
    final id = json['pendingRequestId'];
    final pending = json['pendingText'];
    final reply = json['pendingReplyToMessageId'];
    if (text is! String || text.length > 4000 ||
        (id != null && (id is! String || !id.startsWith('request_'))) ||
        (pending != null && (pending is! String ||
            pending.trim().isEmpty || pending.length > 4000)) ||
        (reply != null && reply is! String) ||
        ((id == null) != (pending == null))) {
      throw const FormatException('Invalid saved human DM draft');
    }
    return HumanChatDraft(
      text: text,
      pendingRequestId: id as String?,
      pendingText: pending as String?,
      pendingReplyToMessageId: reply as String?,
    );
  }
}

abstract class HumanChatDraftStore {
  Future<HumanChatDraft?> read(HumanChatScope scope);
  Future<void> write(HumanChatScope scope, HumanChatDraft value);
  Future<void> remove(HumanChatScope scope);
  /// Must purge only this authenticated account's drafts, never global keys.
  Future<void> clearAccount(String tenantId, String userId);
}

/// Adapter to C02's authenticated, idempotent send. Implementors must preserve
/// clientRequestId and must NOT report success on a timeout or on a local queue.
abstract class HumanChatSendPort {
  bool get supportsReply;
  Future<HumanChatServerAck> send({
    required HumanChatScope scope,
    required String clientRequestId,
    required String text,
    String? replyToMessageId,
  });
}

@immutable
class HumanChatServerAck {
  const HumanChatServerAck({
    required this.conversationId,
    required this.clientRequestId,
    required this.messageId,
  });
  final String conversationId;
  final String clientRequestId;
  final String messageId;
}

/// Quote is usable only when a currently authorized message and its revision
/// remain visible. Tombstones must never preserve hidden cached text.
@immutable
class HumanChatReplyQuote {
  const HumanChatReplyQuote({
    required this.messageId,
    required this.preview,
    required this.revision,
    this.available = true,
  });
  final String messageId;
  final String preview;
  final String revision;
  final bool available;
}
