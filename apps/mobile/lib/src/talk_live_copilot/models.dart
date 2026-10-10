enum HostCopilotStatus {
  published, denied, uncertain, inProgress, budgetExhausted, conflict
}

class HostCopilotSuggestion {
  const HostCopilotSuggestion({required this.kind, required this.prompt});
  final String kind;
  final String prompt;

  factory HostCopilotSuggestion.fromJson(Map<String, dynamic> json) {
    if (!['question', 'poll', 'topic'].contains(json['kind']) ||
        json['trust'] != 'public-untrusted-data' ||
        json['prompt'] is! String ||
        (json['prompt'] as String).trim().isEmpty ||
        (json['prompt'] as String).length > 300) {
      throw const FormatException('Invalid Host suggestion');
    }
    return HostCopilotSuggestion(
      kind: json['kind'] as String, prompt: json['prompt'] as String,
    );
  }
}

class HostCopilotTurnReceipt {
  const HostCopilotTurnReceipt({required this.status, required this.reason});
  final HostCopilotStatus status;
  final String reason;

  factory HostCopilotTurnReceipt.fromJson(Map<String, dynamic> json) {
    final status = switch (json['status']) {
      'published' => HostCopilotStatus.published,
      'denied' => HostCopilotStatus.denied,
      'uncertain' => HostCopilotStatus.uncertain,
      'in_progress' => HostCopilotStatus.inProgress,
      'budget_exhausted' => HostCopilotStatus.budgetExhausted,
      'conflict' => HostCopilotStatus.conflict,
      _ => throw const FormatException('Unknown Host turn status'),
    };
    final reason = json['reason'];
    if (reason is! String || reason.isEmpty || reason.length > 160) {
      throw const FormatException('Invalid Host turn reason');
    }
    return HostCopilotTurnReceipt(status: status, reason: reason);
  }
}

abstract interface class HostCopilotTransport {
  Future<List<HostCopilotSuggestion>> suggestions(String talkId);
  Future<HostCopilotTurnReceipt> approveTurn({
    required String talkId, required String seatId,
    required String requestId, required String hostApprovedTranscript,
  });
}
