import 'shell_document.dart';

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
    this.document,
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
  final ShellDocument? document;

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
    if (document != null) 'document': document!.toJson(),
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

  AgentMessagePart copyWith({
    AgentMessagePartKind? kind,
    String? title,
    String? body,
    String? status,
    int? progressCurrent,
    int? progressTotal,
    int? durationMs,
    AgentFileRef? file,
    String? referenceId,
    String? actionLabel,
    ShellDocument? document,
  }) =>
      AgentMessagePart(
        kind: kind ?? this.kind,
        title: title ?? this.title,
        body: body ?? this.body,
        status: status ?? this.status,
        progressCurrent: progressCurrent ?? this.progressCurrent,
        progressTotal: progressTotal ?? this.progressTotal,
        durationMs: durationMs ?? this.durationMs,
        file: file ?? this.file,
        referenceId: referenceId ?? this.referenceId,
        actionLabel: actionLabel ?? this.actionLabel,
        document: document ?? this.document,
      );

  factory AgentMessagePart.fromJson(Map<String, dynamic> json) {
    String? text(String key) =>
        json[key] is String ? json[key] as String : null;
    int? integer(String key) => json[key] is int ? json[key] as int : null;
    final kind =
        AgentMessagePartKind.parse(text('kind')) ?? AgentMessagePartKind.status;
    ShellDocument? document;
    final rawDocument = json['document'];
    if (rawDocument is Map && rawDocument.keys.every((key) => key is String)) {
      try {
        document = ShellDocument.fromJson(
          Map<String, dynamic>.from(rawDocument),
        );
      } on FormatException {
        // Keep text fallback when remote presentation cannot be rendered.
      }
    }
    AgentFileRef? file;
    final rawFile = json['file'];
    if (rawFile is Map && rawFile.keys.every((key) => key is String)) {
      try {
        file = AgentFileRef.fromJson(Map<String, dynamic>.from(rawFile));
      } on FormatException {
        /* A bad attachment must not hide the message. */
      } on TypeError {
        /* Unsupported field shape; retain readable text. */
      }
    }
    final fallback = rawDocument is Map && rawDocument['fallback'] is String
        ? rawDocument['fallback'] as String
        : null;
    return AgentMessagePart(
      kind: kind,
      document: document,
      title: text('title'),
      body:
          text('body') ??
          (fallback != null && fallback.length <= 4000 ? fallback : null),
      status: text('status'),
      progressCurrent: integer('progressCurrent'),
      progressTotal: integer('progressTotal'),
      durationMs: integer('durationMs'),
      file: file,
      referenceId: text('referenceId'),
      actionLabel: text('actionLabel'),
    );
  }
}
