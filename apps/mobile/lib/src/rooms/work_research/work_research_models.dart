enum WorkResearchRoomKind {
  workBusiness,
  researchAnswers,
}

WorkResearchRoomKind workResearchRoomKindFromWire(String value) {
  switch (value) {
    case 'work-business':
      return WorkResearchRoomKind.workBusiness;
    case 'research-answers':
      return WorkResearchRoomKind.researchAnswers;
    default:
      throw FormatException('Unknown Work/Research room kind: $value');
  }
}

enum WorkResearchItemStatus {
  queued,
  working,
  waiting,
  completed,
  failed,
}

WorkResearchItemStatus _itemStatusFromWire(String value) {
  switch (value) {
    case 'queued':
      return WorkResearchItemStatus.queued;
    case 'working':
      return WorkResearchItemStatus.working;
    case 'waiting':
      return WorkResearchItemStatus.waiting;
    case 'completed':
      return WorkResearchItemStatus.completed;
    case 'failed':
      return WorkResearchItemStatus.failed;
    default:
      throw FormatException('Unknown Work/Research item status: $value');
  }
}

class WorkResearchQuickStart {
  const WorkResearchQuickStart({
    required this.intentId,
    required this.label,
    required this.description,
    this.iconKey,
  });

  final String intentId;
  final String label;
  final String description;
  final String? iconKey;

  factory WorkResearchQuickStart.fromJson(Map<String, dynamic> json) {
    final intentId = json['intentId'];
    final label = json['label'];
    final description = json['description'];
    final iconKey = json['iconKey'];
    if (intentId is! String ||
        intentId.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        description is! String ||
        description.trim().isEmpty ||
        (iconKey != null && iconKey is! String)) {
      throw const FormatException('Invalid Work/Research quick start');
    }
    return WorkResearchQuickStart(
      intentId: intentId,
      label: label,
      description: description,
      iconKey: iconKey as String?,
    );
  }
}

class WorkResearchArtifact {
  const WorkResearchArtifact({
    required this.artifactId,
    required this.label,
    required this.kind,
    this.uri,
  });

  final String artifactId;
  final String label;
  final String kind;
  final Uri? uri;

  factory WorkResearchArtifact.fromJson(Map<String, dynamic> json) {
    final artifactId = json['artifactId'];
    final label = json['label'];
    final kind = json['kind'];
    final rawUri = json['uri'];
    if (artifactId is! String ||
        artifactId.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        kind is! String ||
        kind.trim().isEmpty ||
        (rawUri != null && rawUri is! String)) {
      throw const FormatException('Invalid Work/Research artifact');
    }
    Uri? uri;
    if (rawUri is String) {
      uri = Uri.tryParse(rawUri);
      if (uri == null || uri.scheme != 'https') {
        throw const FormatException('Artifact URI must be HTTPS');
      }
    }
    return WorkResearchArtifact(
      artifactId: artifactId,
      label: label,
      kind: kind,
      uri: uri,
    );
  }
}

class WorkResearchEvidence {
  const WorkResearchEvidence({
    required this.evidenceId,
    required this.title,
    required this.sourceUri,
    this.publisher,
    this.observedAt,
  });

  final String evidenceId;
  final String title;
  final Uri sourceUri;
  final String? publisher;
  final DateTime? observedAt;

  factory WorkResearchEvidence.fromJson(Map<String, dynamic> json) {
    final evidenceId = json['evidenceId'];
    final title = json['title'];
    final rawUri = json['sourceUri'];
    final publisher = json['publisher'];
    final rawObservedAt = json['observedAt'];
    if (evidenceId is! String ||
        evidenceId.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        rawUri is! String ||
        (publisher != null && publisher is! String) ||
        (rawObservedAt != null && rawObservedAt is! String)) {
      throw const FormatException('Invalid Work/Research evidence');
    }
    final sourceUri = Uri.tryParse(rawUri);
    if (sourceUri == null || sourceUri.scheme != 'https') {
      throw const FormatException('Evidence source must be HTTPS');
    }
    final observedAt = rawObservedAt is String
        ? DateTime.tryParse(rawObservedAt)?.toLocal()
        : null;
    if (rawObservedAt != null && observedAt == null) {
      throw const FormatException('Invalid evidence observedAt');
    }
    return WorkResearchEvidence(
      evidenceId: evidenceId,
      title: title,
      sourceUri: sourceUri,
      publisher: publisher as String?,
      observedAt: observedAt,
    );
  }
}

class WorkResearchItem {
  const WorkResearchItem({
    required this.itemId,
    required this.title,
    required this.summary,
    required this.status,
    required this.progress,
    required this.artifacts,
    required this.evidence,
  });

  final String itemId;
  final String title;
  final String summary;
  final WorkResearchItemStatus status;
  final double progress;
  final List<WorkResearchArtifact> artifacts;
  final List<WorkResearchEvidence> evidence;

  factory WorkResearchItem.fromJson(Map<String, dynamic> json) {
    final itemId = json['itemId'];
    final title = json['title'];
    final summary = json['summary'];
    final status = json['status'];
    final progress = json['progress'];
    final artifacts = json['artifacts'];
    final evidence = json['evidence'];
    if (itemId is! String ||
        itemId.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        summary is! String ||
        status is! String ||
        progress is! num ||
        progress < 0 ||
        progress > 1 ||
        artifacts is! List ||
        evidence is! List) {
      throw const FormatException('Invalid Work/Research item');
    }
    return WorkResearchItem(
      itemId: itemId,
      title: title,
      summary: summary,
      status: _itemStatusFromWire(status),
      progress: progress.toDouble(),
      artifacts: [
        for (final item in artifacts)
          if (item is Map)
            WorkResearchArtifact.fromJson(item.cast<String, dynamic>()),
      ],
      evidence: [
        for (final item in evidence)
          if (item is Map)
            WorkResearchEvidence.fromJson(item.cast<String, dynamic>()),
      ],
    );
  }
}

class WorkResearchRoomProjection {
  const WorkResearchRoomProjection({
    required this.kind,
    required this.title,
    required this.subtitle,
    required this.quickStarts,
    required this.items,
  });

  final WorkResearchRoomKind kind;
  final String title;
  final String subtitle;
  final List<WorkResearchQuickStart> quickStarts;
  final List<WorkResearchItem> items;

  factory WorkResearchRoomProjection.fromJson(Map<String, dynamic> json) {
    final kind = json['kind'];
    final title = json['title'];
    final subtitle = json['subtitle'];
    final quickStarts = json['quickStarts'];
    final items = json['items'];
    if (kind is! String ||
        title is! String ||
        title.trim().isEmpty ||
        subtitle is! String ||
        quickStarts is! List ||
        items is! List) {
      throw const FormatException('Invalid Work/Research room projection');
    }
    return WorkResearchRoomProjection(
      kind: workResearchRoomKindFromWire(kind),
      title: title,
      subtitle: subtitle,
      quickStarts: [
        for (final item in quickStarts)
          if (item is Map)
            WorkResearchQuickStart.fromJson(item.cast<String, dynamic>()),
      ],
      items: [
        for (final item in items)
          if (item is Map)
            WorkResearchItem.fromJson(item.cast<String, dynamic>()),
      ],
    );
  }
}
