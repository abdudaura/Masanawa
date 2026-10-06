enum StudyContinuation {
  continueLesson,
  reteach,
  advance,
  complete,
}

StudyContinuation _studyContinuationFromWire(String value) {
  switch (value) {
    case 'continue':
      return StudyContinuation.continueLesson;
    case 'reteach':
      return StudyContinuation.reteach;
    case 'advance':
      return StudyContinuation.advance;
    case 'complete':
      return StudyContinuation.complete;
    default:
      throw FormatException('Unknown Study continuation: $value');
  }
}

enum StudyCardKind {
  lesson,
  singleSelect,
  multiSelect,
  freeResponse,
  feedback,
}

StudyCardKind _studyCardKindFromWire(String value) {
  switch (value) {
    case 'lesson':
      return StudyCardKind.lesson;
    case 'single-select':
      return StudyCardKind.singleSelect;
    case 'multi-select':
      return StudyCardKind.multiSelect;
    case 'free-response':
      return StudyCardKind.freeResponse;
    case 'feedback':
      return StudyCardKind.feedback;
    default:
      throw FormatException('Unknown Study card kind: $value');
  }
}

class StudyPresentationCapabilities {
  const StudyPresentationCapabilities({
    required this.textEnabled,
    required this.voiceEnabled,
  });

  final bool textEnabled;
  final bool voiceEnabled;

  factory StudyPresentationCapabilities.fromJson(Map<String, dynamic> json) {
    final textEnabled = json['textEnabled'];
    final voiceEnabled = json['voiceEnabled'];
    if (textEnabled is! bool || voiceEnabled is! bool) {
      throw const FormatException('Invalid Study presentation capabilities');
    }
    if (!textEnabled && !voiceEnabled) {
      throw const FormatException('Study Center requires text or voice presentation');
    }
    return StudyPresentationCapabilities(
      textEnabled: textEnabled,
      voiceEnabled: voiceEnabled,
    );
  }
}

class StudyProgressProjection {
  const StudyProgressProjection({
    required this.completedSteps,
    required this.totalSteps,
    required this.continuation,
    required this.canResume,
  });

  final int completedSteps;
  final int totalSteps;
  final StudyContinuation continuation;
  final bool canResume;

  double get fraction => totalSteps == 0 ? 0 : completedSteps / totalSteps;

  factory StudyProgressProjection.fromJson(Map<String, dynamic> json) {
    final completed = json['completedSteps'];
    final total = json['totalSteps'];
    final continuation = json['continuation'];
    final canResume = json['canResume'];
    if (completed is! int ||
        total is! int ||
        total < 0 ||
        completed < 0 ||
        completed > total ||
        continuation is! String ||
        canResume is! bool) {
      throw const FormatException('Invalid Study progress projection');
    }
    return StudyProgressProjection(
      completedSteps: completed,
      totalSteps: total,
      continuation: _studyContinuationFromWire(continuation),
      canResume: canResume,
    );
  }
}

class StudyOptionProjection {
  const StudyOptionProjection({
    required this.selectionId,
    required this.label,
    required this.selected,
  });

  final String selectionId;
  final String label;
  final bool selected;

  factory StudyOptionProjection.fromJson(Map<String, dynamic> json) {
    final selectionId = json['selectionId'];
    final label = json['label'];
    final selected = json['selected'];
    if (selectionId is! String ||
        selectionId.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        selected is! bool) {
      throw const FormatException('Invalid Study option');
    }
    return StudyOptionProjection(
      selectionId: selectionId,
      label: label,
      selected: selected,
    );
  }
}

class StudyArtifactProjection {
  const StudyArtifactProjection({
    required this.artifactId,
    required this.title,
    required this.kind,
    required this.altText,
  });

  final String artifactId;
  final String title;
  final String kind;
  final String altText;

  factory StudyArtifactProjection.fromJson(Map<String, dynamic> json) {
    final artifactId = json['artifactId'];
    final title = json['title'];
    final kind = json['kind'];
    final altText = json['altText'];
    if (artifactId is! String ||
        artifactId.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        kind is! String ||
        kind.trim().isEmpty ||
        altText is! String) {
      throw const FormatException('Invalid Study artifact projection');
    }
    return StudyArtifactProjection(
      artifactId: artifactId,
      title: title,
      kind: kind,
      altText: altText,
    );
  }
}

class StudyCardProjection {
  const StudyCardProjection({
    required this.kind,
    required this.title,
    required this.body,
    required this.actionToken,
    required this.revision,
    required this.options,
    required this.artifacts,
    this.feedbackPositive,
  });

  final StudyCardKind kind;
  final String title;
  final String body;
  final String? actionToken;
  final int revision;
  final List<StudyOptionProjection> options;
  final List<StudyArtifactProjection> artifacts;
  final bool? feedbackPositive;

  factory StudyCardProjection.fromJson(Map<String, dynamic> json) {
    final kindRaw = json['kind'];
    final title = json['title'];
    final body = json['body'];
    final actionToken = json['actionToken'];
    final revision = json['revision'];
    final options = json['options'];
    final artifacts = json['artifacts'];
    final feedbackPositive = json['feedbackPositive'];
    if (kindRaw is! String ||
        title is! String ||
        body is! String ||
        (actionToken != null && actionToken is! String) ||
        revision is! int ||
        revision < 0 ||
        options is! List ||
        artifacts is! List ||
        (feedbackPositive != null && feedbackPositive is! bool)) {
      throw const FormatException('Invalid Study card projection');
    }
    final kind = _studyCardKindFromWire(kindRaw);
    final parsedOptions = [
      for (final item in options)
        if (item is Map)
          StudyOptionProjection.fromJson(item.cast<String, dynamic>()),
    ];
    if (parsedOptions.length != options.length) {
      throw const FormatException('Invalid Study options');
    }
    final parsedArtifacts = [
      for (final item in artifacts)
        if (item is Map)
          StudyArtifactProjection.fromJson(item.cast<String, dynamic>()),
    ];
    if (parsedArtifacts.length != artifacts.length) {
      throw const FormatException('Invalid Study artifacts');
    }
    final interactive = kind == StudyCardKind.singleSelect ||
        kind == StudyCardKind.multiSelect ||
        kind == StudyCardKind.freeResponse;
    if (interactive && (actionToken is! String || actionToken.trim().isEmpty)) {
      throw const FormatException('Interactive Study cards require an opaque action token');
    }
    if (!interactive && actionToken != null) {
      throw const FormatException('Non-interactive Study cards cannot carry an action token');
    }
    if (kind == StudyCardKind.singleSelect && parsedOptions.length < 2) {
      throw const FormatException('Single-select Study cards require options');
    }
    if (kind == StudyCardKind.multiSelect && parsedOptions.length < 2) {
      throw const FormatException('Multi-select Study cards require options');
    }
    if (kind == StudyCardKind.freeResponse && parsedOptions.isNotEmpty) {
      throw const FormatException('Free-response Study cards cannot expose options');
    }

    return StudyCardProjection(
      kind: kind,
      title: title,
      body: body,
      actionToken: actionToken as String?,
      revision: revision,
      options: parsedOptions,
      artifacts: parsedArtifacts,
      feedbackPositive: feedbackPositive as bool?,
    );
  }
}

class StudyCenterProjection {
  const StudyCenterProjection({
    required this.title,
    required this.subtitle,
    required this.topic,
    required this.language,
    required this.capabilities,
    required this.progress,
    required this.card,
  });

  final String title;
  final String subtitle;
  final String topic;
  final String language;
  final StudyPresentationCapabilities capabilities;
  final StudyProgressProjection progress;
  final StudyCardProjection? card;

  factory StudyCenterProjection.fromJson(Map<String, dynamic> json) {
    final title = json['title'];
    final subtitle = json['subtitle'];
    final topic = json['topic'];
    final language = json['language'];
    final capabilities = json['capabilities'];
    final progress = json['progress'];
    final card = json['card'];
    if (title is! String ||
        title.trim().isEmpty ||
        subtitle is! String ||
        topic is! String ||
        topic.trim().isEmpty ||
        language is! String ||
        language.trim().isEmpty ||
        capabilities is! Map ||
        progress is! Map ||
        (card != null && card is! Map)) {
      throw const FormatException('Invalid Study Center projection');
    }
    return StudyCenterProjection(
      title: title,
      subtitle: subtitle,
      topic: topic,
      language: language,
      capabilities:
          StudyPresentationCapabilities.fromJson(capabilities.cast<String, dynamic>()),
      progress: StudyProgressProjection.fromJson(progress.cast<String, dynamic>()),
      card: card is Map
          ? StudyCardProjection.fromJson(card.cast<String, dynamic>())
          : null,
    );
  }
}

enum StudyCenterActionKind {
  select,
  toggle,
  commit,
  freeResponse,
  resume,
  listen,
  openArtifact,
}

class StudyCenterActionIntent {
  const StudyCenterActionIntent({
    required this.kind,
    this.actionToken,
    this.selectionId,
    this.responseText,
    this.revision,
    this.artifactId,
  });

  final StudyCenterActionKind kind;
  final String? actionToken;
  final String? selectionId;
  final String? responseText;
  final int? revision;
  final String? artifactId;

  factory StudyCenterActionIntent.select({
    required String actionToken,
    required String selectionId,
    required int revision,
  }) =>
      StudyCenterActionIntent(
        kind: StudyCenterActionKind.select,
        actionToken: actionToken,
        selectionId: selectionId,
        revision: revision,
      );

  factory StudyCenterActionIntent.toggle({
    required String actionToken,
    required String selectionId,
    required int revision,
  }) =>
      StudyCenterActionIntent(
        kind: StudyCenterActionKind.toggle,
        actionToken: actionToken,
        selectionId: selectionId,
        revision: revision,
      );

  factory StudyCenterActionIntent.commit({
    required String actionToken,
    required int revision,
  }) =>
      StudyCenterActionIntent(
        kind: StudyCenterActionKind.commit,
        actionToken: actionToken,
        revision: revision,
      );

  factory StudyCenterActionIntent.freeResponse({
    required String actionToken,
    required String responseText,
    required int revision,
  }) =>
      StudyCenterActionIntent(
        kind: StudyCenterActionKind.freeResponse,
        actionToken: actionToken,
        responseText: responseText,
        revision: revision,
      );

  const factory StudyCenterActionIntent.resume() = StudyResumeIntent;
  const factory StudyCenterActionIntent.listen() = StudyListenIntent;

  factory StudyCenterActionIntent.openArtifact(String artifactId) =>
      StudyCenterActionIntent(
        kind: StudyCenterActionKind.openArtifact,
        artifactId: artifactId,
      );
}

class StudyResumeIntent extends StudyCenterActionIntent {
  const StudyResumeIntent() : super(kind: StudyCenterActionKind.resume);
}

class StudyListenIntent extends StudyCenterActionIntent {
  const StudyListenIntent() : super(kind: StudyCenterActionKind.listen);
}
