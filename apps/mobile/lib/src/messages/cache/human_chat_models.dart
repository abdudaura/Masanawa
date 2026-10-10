/// Local projection of a server-authenticated *human* conversation.
/// The cache never grants conversation membership or authorizes a send.
class CachedHumanThread {
  const CachedHumanThread({
    required this.conversationId,
    required this.peerUserId,
    this.displayName,
    required this.updatedAtMs,
    this.lastSequence = 0,
    this.preview,
    this.unreadCount = 0,
  });
  final String conversationId;
  final String peerUserId;
  final String? displayName;
  final int updatedAtMs;
  final int lastSequence;
  final String? preview;
  final int unreadCount;

  factory CachedHumanThread.fromRow(Map<String, Object?> row) =>
      CachedHumanThread(
        conversationId: row['conversation_id'] as String,
        peerUserId: row['peer_user_id'] as String,
        displayName: row['display_name'] as String?,
        updatedAtMs: row['updated_at_ms'] as int,
        lastSequence: row['last_sequence'] as int,
        preview: row['preview'] as String?,
        unreadCount: row['unread_count'] as int,
      );
}

/// Only server acknowledgments produce [sequence] and [messageId].
/// Pending messages remain in the separate durable outbox.
class CachedHumanMessage {
  const CachedHumanMessage({
    required this.messageId,
    required this.conversationId,
    required this.senderUserId,
    required this.sequence,
    required this.createdAtMs,
    this.clientRequestId,
    this.body,
    this.deleted = false,
  });
  final String messageId;
  final String conversationId;
  final String senderUserId;
  final int sequence;
  final int createdAtMs;
  final String? clientRequestId;
  final String? body;
  final bool deleted;

  factory CachedHumanMessage.fromRow(Map<String, Object?> row) =>
      CachedHumanMessage(
        messageId: row['message_id'] as String,
        conversationId: row['conversation_id'] as String,
        senderUserId: row['sender_user_id'] as String,
        sequence: row['sequence'] as int,
        createdAtMs: row['created_at_ms'] as int,
        clientRequestId: row['client_request_id'] as String?,
        body: row['body'] as String?,
        deleted: row['deleted'] == 1,
      );
}

/// Never label an unacknowledged offline message as delivered.
enum HumanOutboxStatus { pending, unknown, blocked }

class CachedHumanOutboxItem {
  const CachedHumanOutboxItem({
    required this.requestId,
    required this.conversationId,
    required this.body,
    required this.createdAtMs,
    required this.attempts,
    required this.retryAfterMs,
    required this.status,
  });
  final String requestId;
  final String conversationId;
  final String body;
  final int createdAtMs;
  final int attempts;
  final int retryAfterMs;
  final HumanOutboxStatus status;

  factory CachedHumanOutboxItem.fromRow(Map<String, Object?> row) =>
      CachedHumanOutboxItem(
        requestId: row['request_id'] as String,
        conversationId: row['conversation_id'] as String,
        body: row['body'] as String,
        createdAtMs: row['created_at_ms'] as int,
        attempts: row['attempts'] as int,
        retryAfterMs: row['retry_after_ms'] as int,
        status: HumanOutboxStatus.values.byName(row['status'] as String),
      );
}
