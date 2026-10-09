import 'human_chat_contract.dart';

/// Strict adapter boundary for C02 #472. The F12 owner supplies a closure
/// backed by HumanDmTransport.send and maps its verified HumanDmMessage into
/// HumanChatServerAck. No competing HTTP endpoint, authorization or receipt.
/// This file compiles independently while the canonical C02 PR is unmerged.
class HumanChatC02Bridge implements HumanChatSendPort {
  const HumanChatC02Bridge({
    required this.sendCanonical,
    this.replySupported = false,
  });

  final Future<HumanChatServerAck> Function(
    String conversationId,
    String clientRequestId,
    String text,
    String? replyToMessageId,
  ) sendCanonical;

  final bool replySupported;
  @override
  bool get supportsReply => replySupported;

  @override
  Future<HumanChatServerAck> send({
    required HumanChatScope scope,
    required String clientRequestId,
    required String text,
    String? replyToMessageId,
  }) {
    if (!scope.valid || clientRequestId.isEmpty || text.trim().isEmpty ||
        text.length > 4000 || (!replySupported && replyToMessageId != null)) {
      throw ArgumentError('Unsupported human DM operation');
    }
    // Canonical C02 must recheck authenticated membership and blocks for
    // EVERY attempt; scope cannot supply auth headers or authorize itself.
    return sendCanonical(
      scope.conversationId,
      clientRequestId,
      text,
      replyToMessageId,
    );
  }
}
