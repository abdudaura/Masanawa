enum TalkQuestionStatus { pending, answered, dismissed }

class TalkQuestion {
  const TalkQuestion({
    required this.questionId,
    required this.authorName,
    required this.body,
    required this.status,
    required this.createdAt,
    this.resolvedAt,
  });

  final String questionId;
  final String authorName;
  final String body;
  final TalkQuestionStatus status;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  factory TalkQuestion.fromJson(Map<String, dynamic> json) {
    final status = switch (json['status']) {
      'answered' => TalkQuestionStatus.answered,
      'dismissed' => TalkQuestionStatus.dismissed,
      _ => TalkQuestionStatus.pending,
    };
    return TalkQuestion(
      questionId: (json['questionId'] as String?) ?? '',
      authorName: (json['authorName'] as String?) ?? '',
      body: (json['body'] as String?) ?? '',
      status: status,
      createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      resolvedAt: DateTime.tryParse((json['resolvedAt'] as String?) ?? ''),
    );
  }
}

abstract interface class TalkQuestionTransport {
  Future<TalkQuestion> submit({
    required String talkId,
    required String body,
  });

  Future<List<TalkQuestion>> loadHostQueue(String talkId);

  Future<List<TalkQuestion>> resolve({
    required String talkId,
    required String questionId,
    required TalkQuestionStatus status,
  });
}
