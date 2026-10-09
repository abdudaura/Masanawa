/// U11 searches current authorized human-to-human messages only.
class HumanMessageSearchHit {
  const HumanMessageSearchHit({
    required this.messageId, required this.conversationId,
    required this.senderUserId, required this.sequence,
    required this.body, required this.createdAtUs, required this.editedAt,
  });
  final String messageId, conversationId, senderUserId, sequence, body, createdAtUs;
  final String? editedAt;
  factory HumanMessageSearchHit.fromJson(Map<String, dynamic> json) {
    String requiredString(String name) {
      final value = json[name];
      if (value is! String || value.isEmpty) throw const FormatException('Invalid search result');
      return value;
    }
    return HumanMessageSearchHit(
      messageId: requiredString('messageId'),
      conversationId: requiredString('conversationId'),
      senderUserId: requiredString('senderUserId'),
      sequence: requiredString('sequence'),
      body: requiredString('body'),
      createdAtUs: requiredString('createdAtUs'),
      editedAt: json['editedAt'] as String?,
    );
  }
}
class HumanMessageSearchPage {
  const HumanMessageSearchPage({required this.hits, this.next});
  final List<HumanMessageSearchHit> hits;
  final String? next;
  factory HumanMessageSearchPage.fromJson(Map<String, dynamic> json) {
    final rows = json['hits'];
    if (rows is! List || (json['next'] != null && json['next'] is! String)) {
      throw const FormatException('Invalid search response');
    }
    return HumanMessageSearchPage(
      hits: List.unmodifiable(rows.map((item) {
        if (item is! Map) throw const FormatException('Invalid search row');
        return HumanMessageSearchHit.fromJson(Map<String, dynamic>.from(item));
      })),
      next: json['next'] as String?,
    );
  }
}
