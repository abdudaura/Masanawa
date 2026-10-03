enum AgentMessagePartKind {
  audio,
  image,
  file,
  artifact,
  work,
  approval,
  operation,
  callResult,
  status;

  static AgentMessagePartKind? parse(String? value) => switch (value) {
        'audio' => AgentMessagePartKind.audio,
        'image' => AgentMessagePartKind.image,
        'file' => AgentMessagePartKind.file,
        'artifact' => AgentMessagePartKind.artifact,
        'work' => AgentMessagePartKind.work,
        'approval' => AgentMessagePartKind.approval,
        'operation' => AgentMessagePartKind.operation,
        'call_result' => AgentMessagePartKind.callResult,
        'status' => AgentMessagePartKind.status,
        _ => null,
      };
}

/// Durable server file/artifact reference. The app may cache bytes locally,
/// but a device path is never the canonical identity of agent-produced work.
class AgentFileRef {
  const AgentFileRef({
    required this.fileId,
    required this.name,
    this.mimeType,
    this.sizeBytes,
    this.previewUrl,
    this.downloadUrl,
  });

  final String fileId;
  final String name;
  final String? mimeType;
  final int? sizeBytes;
  final String? previewUrl;
  final String? downloadUrl;

  Map<String, dynamic> toJson() => {
        'fileId': fileId,
        'name': name,
        if (mimeType != null) 'mimeType': mimeType,
        if (sizeBytes != null) 'sizeBytes': sizeBytes,
        if (previewUrl != null) 'previewUrl': previewUrl,
        if (downloadUrl != null) 'downloadUrl': downloadUrl,
      };

  factory AgentFileRef.fromJson(Map<String, dynamic> json) {
    final id = json['fileId'];
    final name = json['name'];
    if (id is! String || id.isEmpty || name is! String || name.isEmpty) {
      throw const FormatException('Invalid file reference');
    }
    return AgentFileRef(
      fileId: id,
      name: name,
      mimeType: json['mimeType'] as String?,
      sizeBytes: json['sizeBytes'] as int?,
      previewUrl: json['previewUrl'] as String?,
      downloadUrl: json['downloadUrl'] as String?,
    );
  }
}

/// One structured result emitted into the conversation. A single assistant
/// message can mix spoken/text narration with multiple result parts.
class AgentMessagePart {
  const AgentMessagePart({
    required this.kind,
    this.title,
    this.body,
    this.status,
    this.progressCurrent,
    this.progressTotal,
    this.durationMs,
    this.file,
    this.referenceId,
    this.actionLabel,
  });

  final AgentMessagePartKind kind;
  final String? title;
  final String? body;
  final String? status;
  final int? progressCurrent;
  final int? progressTotal;
  final int? durationMs;
  final AgentFileRef? file;

  /// Workflow/approval/Operation/call/run reference. It is display metadata,
  /// never authority.
  final String? referenceId;
  final String? actionLabel;

  Map<String, dynamic> toJson() => {
        'kind': switch (kind) {
          AgentMessagePartKind.audio => 'audio',
          AgentMessagePartKind.image => 'image',
          AgentMessagePartKind.file => 'file',
          AgentMessagePartKind.artifact => 'artifact',
          AgentMessagePartKind.work => 'work',
          AgentMessagePartKind.approval => 'approval',
          AgentMessagePartKind.operation => 'operation',
          AgentMessagePartKind.callResult => 'call_result',
          AgentMessagePartKind.status => 'status',
        },
        if (title != null) 'title': title,
        if (body != null) 'body': body,
        if (status != null) 'status': status,
        if (progressCurrent != null) 'progressCurrent': progressCurrent,
        if (progressTotal != null) 'progressTotal': progressTotal,
        if (durationMs != null) 'durationMs': durationMs,
        if (file != null) 'file': file!.toJson(),
        if (referenceId != null) 'referenceId': referenceId,
        if (actionLabel != null) 'actionLabel': actionLabel,
      };

  factory AgentMessagePart.fromJson(Map<String, dynamic> json) {
    final kind = AgentMessagePartKind.parse(json['kind'] as String?);
    if (kind == null) throw const FormatException('Unknown message part kind');
    final rawFile = json['file'];
    return AgentMessagePart(
      kind: kind,
      title: json['title'] as String?,
      body: json['body'] as String?,
      status: json['status'] as String?,
      progressCurrent: json['progressCurrent'] as int?,
      progressTotal: json['progressTotal'] as int?,
      durationMs: json['durationMs'] as int?,
      file: rawFile is Map
          ? AgentFileRef.fromJson(rawFile.cast<String, dynamic>())
          : null,
      referenceId: json['referenceId'] as String?,
      actionLabel: json['actionLabel'] as String?,
    );
  }
}
