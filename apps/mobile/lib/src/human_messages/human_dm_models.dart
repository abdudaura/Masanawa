/// Typed person-to-person DM records. Distinct from AI character chat and public Talks.
class HumanDmMessage {
  const HumanDmMessage({
    required this.messageId, required this.conversationId, required this.sequence,
    required this.senderUserId, required this.clientRequestId, required this.body,
    required this.createdAt, required this.editedAt, required this.deletedAt,
  });
  final String messageId, conversationId, sequence, senderUserId, clientRequestId;
  final String? body, editedAt, deletedAt;
  final DateTime createdAt;
  factory HumanDmMessage.fromJson(Map<String, dynamic> json) => HumanDmMessage(
    messageId: json['messageId'] as String,
    conversationId: json['conversationId'] as String,
    sequence: json['sequence'] as String,
    senderUserId: json['senderUserId'] as String,
    clientRequestId: json['clientRequestId'] as String,
    body: json['body'] as String?,
    createdAt: DateTime.parse(json['createdAt'] as String),
    editedAt: json['editedAt'] as String?,
    deletedAt: json['deletedAt'] as String?,
  );
}
class HumanDmConversation {
  const HumanDmConversation({required this.conversationId, required this.otherUserId,
    required this.lastSequence, required this.preview, required this.updatedAt,
    required this.otherDisplayName,required this.otherAvatarUrl,
    required this.unreadCount});
  final String conversationId, otherUserId, lastSequence, otherDisplayName;
  final String? otherAvatarUrl;
  final String? preview;
  final DateTime updatedAt;
  final int unreadCount;
  factory HumanDmConversation.fromJson(Map<String, dynamic> json) => HumanDmConversation(
    conversationId: json['conversationId'] as String,
    otherUserId: json['otherUserId'] as String,
    otherDisplayName: json['otherDisplayName'] as String,
    otherAvatarUrl: json['otherAvatarUrl'] as String?,
    lastSequence: json['lastSequence'] as String,
    preview: json['preview'] as String?,
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    unreadCount: (json['unreadCount'] as num).toInt(),
  );
}
class HumanDmPage {
  const HumanDmPage({required this.messages, this.nextBefore});
  final List<HumanDmMessage> messages;
  final String? nextBefore;
}
