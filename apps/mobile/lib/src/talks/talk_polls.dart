class TalkPollOption {
  const TalkPollOption({
    required this.optionId,
    required this.label,
    required this.voteCount,
  });

  final String optionId;
  final String label;
  final int voteCount;

  factory TalkPollOption.fromJson(Map<String, dynamic> json) {
    final id = json['optionId'];
    final label = json['label'];
    final votes = json['voteCount'];
    if (id is! String || label is! String || votes is! num) {
      throw const FormatException('Invalid Talk poll option');
    }
    return TalkPollOption(
      optionId: id,
      label: label,
      voteCount: votes.toInt(),
    );
  }
}

class TalkPoll {
  const TalkPoll({
    required this.pollId,
    required this.question,
    required this.isOpen,
    required this.options,
    required this.totalVotes,
    required this.createdAt,
    this.myOptionId,
    this.closedAt,
  });

  final String pollId;
  final String question;
  final bool isOpen;
  final List<TalkPollOption> options;
  final int totalVotes;
  final String? myOptionId;
  final DateTime createdAt;
  final DateTime? closedAt;

  factory TalkPoll.fromJson(Map<String, dynamic> json) {
    final pollId = json['pollId'];
    final question = json['question'];
    final status = json['status'];
    final rawOptions = json['options'];
    final totalVotes = json['totalVotes'];
    final createdAt = json['createdAt'];
    if (pollId is! String ||
        question is! String ||
        (status != 'open' && status != 'closed') ||
        rawOptions is! List ||
        totalVotes is! num ||
        createdAt is! String) {
      throw const FormatException('Invalid Talk poll');
    }

    final options = rawOptions.map((item) {
      if (item is Map<String, dynamic>) return TalkPollOption.fromJson(item);
      if (item is Map) {
        return TalkPollOption.fromJson(item.cast<String, dynamic>());
      }
      throw const FormatException('Invalid Talk poll option');
    }).toList(growable: false);

    return TalkPoll(
      pollId: pollId,
      question: question,
      isOpen: status == 'open',
      options: options,
      totalVotes: totalVotes.toInt(),
      myOptionId: json['myOptionId'] as String?,
      createdAt: DateTime.parse(createdAt).toLocal(),
      closedAt: json['closedAt'] is String
          ? DateTime.parse(json['closedAt'] as String).toLocal()
          : null,
    );
  }
}

class TalkPollDraft {
  const TalkPollDraft({required this.question, required this.options});

  final String question;
  final List<String> options;
}

abstract interface class TalkPollTransport {
  Future<TalkPoll?> load(String talkId);

  Future<TalkPoll> create({
    required String talkId,
    required String question,
    required List<String> options,
  });

  Future<TalkPoll> vote({
    required String talkId,
    required String pollId,
    required String optionId,
  });

  Future<TalkPoll> close({
    required String talkId,
    required String pollId,
  });
}
