import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:mime/mime.dart';

import '../agents/agent_session.dart';
import '../agents/agent_feedback.dart';
import '../chat/chat_format.dart';
import '../chat/message_parts.dart';
import '../core/providers.dart';
import '../core/network/api_client.dart';

const String _kThreadsFile = 'masanawa_threads_v2.json';

/// A user-selected local attachment. Local paths are only upload/cache inputs;
/// canonical agent-produced files arrive back as durable AgentFileRef parts.
class ChatAttachment {
  const ChatAttachment({
    required this.kind,
    required this.path,
    this.name,
    this.sizeBytes,
    this.durationMs,
  });

  final String kind;
  final String path;
  final String? name;
  final int? sizeBytes;
  final int? durationMs;

  String get label => switch (kind) {
    'image' => '📷 Photo',
    'voice' => '🎤 Voice note (${formatDurationMs(durationMs ?? 0)})',
    _ => '📄 ${name ?? 'Document'}',
  };

  Map<String, dynamic> toJson() => {
    'kind': kind,
    'path': path,
    if (name != null) 'name': name,
    if (sizeBytes != null) 'sizeBytes': sizeBytes,
    if (durationMs != null) 'durationMs': durationMs,
  };

  factory ChatAttachment.fromJson(Map<String, dynamic> json) => ChatAttachment(
    kind: json['kind'] as String? ?? 'doc',
    path: json['path'] as String? ?? '',
    name: json['name'] as String?,
    sizeBytes: json['sizeBytes'] as int?,
    durationMs: json['durationMs'] as int?,
  );
}

class AiChatMessage {
  const AiChatMessage({
    required this.id,
    required this.isUser,
    required this.text,
    required this.createdAt,
    this.attachment,
    this.attachments = const [],
    this.parts = const [],
    this.replyToId,
    this.replyPreview,
    this.reaction,
    this.editedAt,
    this.deleted = false,
    this.deliveryStatus = 'sent',
    this.uploadProgress,
  });

  final String id;
  final bool isUser;
  final String text;
  final DateTime createdAt;
  final ChatAttachment? attachment;
  final List<ChatAttachment> attachments;
  final List<AgentMessagePart> parts;
  final String? replyToId;
  final String? replyPreview;
  final String? reaction;
  final DateTime? editedAt;
  final bool deleted;
  final String deliveryStatus;
  final double? uploadProgress;

  List<ChatAttachment> get allAttachments => [
    if (attachment != null) attachment!,
    ...attachments,
  ];

  AiChatMessage copyWith({
    String? text,
    ChatAttachment? attachment,
    List<ChatAttachment>? attachments,
    List<AgentMessagePart>? parts,
    String? replyToId,
    String? replyPreview,
    String? reaction,
    DateTime? editedAt,
    bool? deleted,
    String? deliveryStatus,
    double? uploadProgress,
  }) => AiChatMessage(
    id: id,
    isUser: isUser,
    text: text ?? this.text,
    createdAt: createdAt,
    attachment: attachment ?? this.attachment,
    attachments: attachments ?? this.attachments,
    parts: parts ?? this.parts,
    replyToId: replyToId ?? this.replyToId,
    replyPreview: replyPreview ?? this.replyPreview,
    reaction: reaction ?? this.reaction,
    editedAt: editedAt ?? this.editedAt,
    deleted: deleted ?? this.deleted,
    deliveryStatus: deliveryStatus ?? this.deliveryStatus,
    uploadProgress: uploadProgress ?? this.uploadProgress,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'isUser': isUser,
    'text': text,
    'createdAt': createdAt.toIso8601String(),
    if (attachment != null) 'attachment': attachment!.toJson(),
    if (attachments.isNotEmpty)
      'attachments': [for (final item in attachments) item.toJson()],
    if (parts.isNotEmpty) 'parts': [for (final part in parts) part.toJson()],
    if (replyToId != null) 'replyToId': replyToId,
    if (replyPreview != null) 'replyPreview': replyPreview,
    if (reaction != null) 'reaction': reaction,
    if (editedAt != null) 'editedAt': editedAt!.toIso8601String(),
    if (deleted) 'deleted': true,
    if (deliveryStatus != 'sent') 'deliveryStatus': deliveryStatus,
    if (uploadProgress != null) 'uploadProgress': uploadProgress,
  };

  factory AiChatMessage.fromJson(Map<String, dynamic> json) => AiChatMessage(
    id: json['id'] as String? ?? '',
    isUser: json['isUser'] as bool? ?? false,
    text: json['text'] as String? ?? '',
    createdAt:
        DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    attachment: json['attachment'] == null
        ? null
        : ChatAttachment.fromJson(
            (json['attachment'] as Map).cast<String, dynamic>(),
          ),
    attachments: [
      for (final raw in (json['attachments'] as List? ?? const []))
        if (raw is Map) ChatAttachment.fromJson(raw.cast<String, dynamic>()),
    ],
    parts: [
      for (final raw in (json['parts'] as List? ?? const []))
        if (raw is Map) AgentMessagePart.fromJson(raw.cast<String, dynamic>()),
    ],
    replyToId: json['replyToId'] as String?,
    replyPreview: json['replyPreview'] as String?,
    reaction: json['reaction'] as String?,
    editedAt: DateTime.tryParse(json['editedAt'] as String? ?? ''),
    deleted: json['deleted'] as bool? ?? false,
    deliveryStatus: json['deliveryStatus'] as String? ?? 'sent',
    uploadProgress: (json['uploadProgress'] as num?)?.toDouble(),
  );
}

/// One conversation per canonical Character.
class ChatThread {
  ChatThread({
    required this.characterId,
    this.messages = const [],
    this.unread = 0,
    DateTime? updatedAt,
    this.characterSessionId,
    this.agentRunId,
    this.draft = '',
    this.title,
    this.pinned = false,
    this.archived = false,
  }) : updatedAt = updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0);

  final String characterId;
  final List<AiChatMessage> messages;
  final int unread;
  final DateTime updatedAt;
  final String? characterSessionId;
  final String? agentRunId;
  final String draft;
  final String? title;
  final bool pinned;
  final bool archived;

  AiChatMessage? get lastMessage => messages.isEmpty ? null : messages.last;

  ChatThread copyWith({
    List<AiChatMessage>? messages,
    int? unread,
    DateTime? updatedAt,
    String? characterSessionId,
    String? agentRunId,
    String? draft,
    String? title,
    bool? pinned,
    bool? archived,
  }) => ChatThread(
    characterId: characterId,
    messages: messages ?? this.messages,
    unread: unread ?? this.unread,
    updatedAt: updatedAt ?? this.updatedAt,
    characterSessionId: characterSessionId ?? this.characterSessionId,
    agentRunId: agentRunId ?? this.agentRunId,
    draft: draft ?? this.draft,
    title: title ?? this.title,
    pinned: pinned ?? this.pinned,
    archived: archived ?? this.archived,
  );

  Map<String, dynamic> toJson() => {
    'characterId': characterId,
    'messages': [for (final m in messages) m.toJson()],
    'unread': unread,
    'updatedAt': updatedAt.toIso8601String(),
    if (characterSessionId != null) 'characterSessionId': characterSessionId,
    if (agentRunId != null) 'agentRunId': agentRunId,
    if (draft.isNotEmpty) 'draft': draft,
    if (title != null) 'title': title,
    if (pinned) 'pinned': true,
    if (archived) 'archived': true,
  };

  factory ChatThread.fromJson(Map<String, dynamic> json) {
    final characterId =
        (json['characterId'] ?? json['masanaId']) as String? ?? '';
    return ChatThread(
      characterId: characterId,
      messages: [
        for (final m in (json['messages'] as List? ?? []))
          AiChatMessage.fromJson((m as Map).cast<String, dynamic>()),
      ],
      unread: json['unread'] as int? ?? 0,
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? ''),
      characterSessionId: json['characterSessionId'] as String?,
      agentRunId: json['agentRunId'] as String?,
      draft: json['draft'] as String? ?? '',
      title: json['title'] as String?,
      pinned: json['pinned'] as bool? ?? false,
      archived: json['archived'] as bool? ?? false,
    );
  }
}

class AiChatState {
  const AiChatState({
    this.threads = const {},
    this.sendingIn = const {},
    this.openThreadId,
  });

  final Map<String, ChatThread> threads;
  final Set<String> sendingIn;
  final String? openThreadId;

  List<ChatThread> get chatList {
    final list = threads.values
        .where((t) => t.messages.isNotEmpty && !t.archived)
        .toList();
    list.sort((a, b) {
      if (a.pinned != b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.compareTo(a.updatedAt);
    });
    return list;
  }

  int get totalUnread => threads.values.fold(0, (sum, t) => sum + t.unread);

  AiChatState copyWith({
    Map<String, ChatThread>? threads,
    Set<String>? sendingIn,
    String? openThreadId,
    bool clearOpen = false,
  }) => AiChatState(
    threads: threads ?? this.threads,
    sendingIn: sendingIn ?? this.sendingIn,
    openThreadId: clearOpen ? null : (openThreadId ?? this.openThreadId),
  );
}

class AiChatController extends Notifier<AiChatState> {
  int _seq = 0;
  bool _disposed = false;
  final Map<String, AgentSessionBinding> _bindings = {};
  int _connectionGeneration = 0;
  final Map<String, int> _threadGenerations = {};
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  bool _flushingQueue = false;

  @override
  AiChatState build() {
    scheduleMicrotask(_load);
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        unawaited(_flushQueuedMessages());
      }
    });
    ref.onDispose(() {
      _disposed = true;
      _connectivitySub?.cancel();
    });
    ref.listen(agentTransportProvider, (_, __) {
      _connectionGeneration++;
      _bindings.clear();
    });
    return const AiChatState();
  }

  ChatThread threadOf(String characterId) =>
      state.threads[characterId] ?? ChatThread(characterId: characterId);

  void openThread(String characterId) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {...state.threads, characterId: thread.copyWith(unread: 0)},
      openThreadId: characterId,
    );
    _save();
    unawaited(_flushQueuedMessages());
  }

  void closeThread() => state = state.copyWith(clearOpen: true);

  Future<bool> _offlineNow() async {
    try {
      final results = await Connectivity().checkConnectivity();
      return results.contains(ConnectivityResult.none);
    } catch (_) {
      return false;
    }
  }

  Future<void> _enqueueMessage(
    String characterId,
    AiChatMessage message,
  ) async {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: [...thread.messages, message.copyWith(deliveryStatus: 'queued')],
          updatedAt: DateTime.now(),
        ),
      },
    );
    await _save();
  }

  Future<void> _flushQueuedMessages() async {
    if (_flushingQueue || _disposed) return;
    _flushingQueue = true;
    try {
      for (final entry in state.threads.entries.toList()) {
        final characterId = entry.key;
        final queued = entry.value.messages
            .where((m) => m.isUser && m.deliveryStatus == 'queued')
            .toList();
        for (final message in queued) {
          if (_disposed) return;
          if (await _offlineNow()) return;
          _setDelivery(characterId, message.id, 'sending');
          await _dispatchUserMessage(characterId, message, retry: true);
        }
      }
    } finally {
      _flushingQueue = false;
    }
  }

  Future<void> sendText(
    String characterId,
    String rawText, {
    String? replyToId,
    String? replyPreview,
  }) async {
    final text = rawText.trim();
    if (text.isEmpty || state.sendingIn.contains(characterId)) return;
    final message = AiChatMessage(
      id: _newId(),
      isUser: true,
      text: text,
      createdAt: DateTime.now(),
      replyToId: replyToId,
      replyPreview: replyPreview,
      deliveryStatus: 'sending',
    );
    if (await _offlineNow()) {
      await _enqueueMessage(characterId, message);
      return;
    }
    await _dispatchUserMessage(characterId, message);
  }

  Future<void> sendAttachment(
    String characterId,
    ChatAttachment attachment, {
    String? caption,
  }) async {
    if (state.sendingIn.contains(characterId)) return;
    final message = AiChatMessage(
      id: _newId(),
      isUser: true,
      text: (caption ?? '').trim(),
      createdAt: DateTime.now(),
      attachment: attachment,
      deliveryStatus: 'sending',
    );
    if (await _offlineNow()) {
      await _enqueueMessage(characterId, message);
      return;
    }
    await _dispatchUserMessage(characterId, message);
  }

  Future<void> sendAttachments(
    String characterId,
    List<ChatAttachment> attachments, {
    String? caption,
  }) async {
    if (attachments.isEmpty || state.sendingIn.contains(characterId)) return;
    if (attachments.length == 1) {
      await sendAttachment(characterId, attachments.first, caption: caption);
      return;
    }
    final bounded = List<ChatAttachment>.unmodifiable(attachments.take(8));
    final message = AiChatMessage(
      id: _newId(),
      isUser: true,
      text: (caption ?? '').trim(),
      createdAt: DateTime.now(),
      attachments: bounded,
      deliveryStatus: 'sending',
      uploadProgress: 0,
    );
    if (await _offlineNow()) {
      await _enqueueMessage(characterId, message);
      return;
    }
    await _dispatchUserMessage(characterId, message);
  }

  Future<void> _dispatchUserMessage(
    String characterId,
    AiChatMessage userMsg, {
    bool retry = false,
  }) async {
    final connectionGeneration = _connectionGeneration;
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: retry ? thread.messages : [...thread.messages, userMsg],
          updatedAt: DateTime.now(),
        ),
      },
      sendingIn: {...state.sendingIn, characterId},
    );
    await _save();
    if (_disposed || threadGeneration != (_threadGenerations[characterId] ?? 0))
      return;
    try {
      final attachment = userMsg.attachment;
      final attachmentSet = userMsg.attachments;
      final hasMedia = attachment != null || attachmentSet.isNotEmpty;
      final streamMessageId =
          !hasMedia ? _beginAiStream(characterId) : null;
      final promptText = userMsg.replyPreview?.trim().isNotEmpty == true
          ? 'Replying to this earlier message:\n"${userMsg.replyPreview}"\n\n${userMsg.text}'
          : userMsg.text;
      final result = !hasMedia
          ? await _sendViaTransport(
              characterId,
              promptText,
              onTextDelta: (delta) {
                if (streamMessageId != null) {
                  _appendAiDelta(characterId, streamMessageId, delta);
                }
              },
            )
          : attachmentSet.isNotEmpty
          ? await _sendMediaSetViaTransport(
              characterId,
              userMsg.id,
              attachmentSet,
              caption: userMsg.text,
            )
          : await _sendMediaViaTransport(
              characterId,
              attachment!,
              caption: userMsg.text,
            );
      if (_disposed ||
          threadGeneration != (_threadGenerations[characterId] ?? 0)) {
        return;
      }
      if (connectionGeneration != _connectionGeneration) {
        throw const ApiException('Connection changed');
      }
      _updateMessage(
        characterId,
        userMsg.id,
        (message) => message.copyWith(
          deliveryStatus: 'delivered',
          uploadProgress: message.allAttachments.length > 1 ? 1.0 : null,
        ),
      );
      ChatAttachment? replyAudio;
      if (result.audioBytes case final audio? when audio.isNotEmpty) {
        final dir = await getTemporaryDirectory();
        final path =
            '${dir.path}/masanawa_reply_${DateTime.now().microsecondsSinceEpoch}.wav';
        await File(path).writeAsBytes(audio, flush: true);
        replyAudio = ChatAttachment(
          kind: 'voice',
          path: path,
          durationMs: result.audioDurationMs,
          sizeBytes: audio.length,
        );
      }
      if (streamMessageId != null) {
        await _finalizeAiStream(
          characterId,
          streamMessageId,
          result.text,
          parts: result.parts,
          attachment: replyAudio,
          agentRunId: result.agentRunId,
        );
      } else {
        await _appendAi(
          characterId,
          result.text,
          parts: result.parts,
          attachment: replyAudio,
          agentRunId: result.agentRunId,
        );
      }
    } catch (error) {
      if (_disposed ||
          threadGeneration != (_threadGenerations[characterId] ?? 0)) {
        return;
      }
      if (error is ApiException &&
          (error.statusCode == 401 ||
              error.statusCode == 403 ||
              error.statusCode == 404)) {
        _bindings.remove(characterId);
      }
      _removeStreamingPlaceholders(characterId);
      _setDelivery(characterId, userMsg.id, 'failed');
      final feedback = AgentFeedback.fromError(error, conversation: true);
      await _appendAi(
        characterId,
        feedback.message,
        parts: [
          AgentMessagePart(
            kind: AgentMessagePartKind.status,
            status: 'failed',
            referenceId: userMsg.id,
            actionLabel: feedback.actionLabel,
          ),
        ],
      );
    }
  }

  Future<void> retryMessage(String characterId, String messageId) async {
    if (state.sendingIn.contains(characterId)) return;
    final thread = threadOf(characterId);
    final users = thread.messages.where((m) => m.id == messageId && m.isUser);
    if (users.isEmpty) return;
    final failures = thread.messages.where(
      (m) => m.parts.any(
        (p) =>
            p.kind == AgentMessagePartKind.status &&
            p.status == 'failed' &&
            p.referenceId == messageId,
      ),
    );
    if (failures.isEmpty) return;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: thread.messages
              .where((m) => !failures.contains(m))
              .toList(),
        ),
      },
    );
    await _dispatchUserMessage(characterId, users.first, retry: true);
  }

  Future<AgentTurnResult> _sendMediaViaTransport(
    String characterId,
    ChatAttachment attachment, {
    required String caption,
  }) async {
    final file = File(attachment.path);
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || bytes.length > 8 * 1024 * 1024) {
      throw const ApiException(
        'Attachment must be between 1 byte and 8 MB',
        code: 'ATTACHMENT_TOO_LARGE',
      );
    }
    // Voice notes are AAC-LC in an M4A container. Gemini accepts audio/m4a;
    // generic inference may label the same container audio/mp4 and reject it.
    final mimeType = attachment.kind == 'voice'
        ? 'audio/m4a'
        : lookupMimeType(
                attachment.path,
                headerBytes: bytes.take(16).toList(),
              ) ??
              switch (attachment.kind) {
                'image' => 'image/jpeg',
                _ => 'application/octet-stream',
              };

    final transport = ref.read(agentTransportProvider);
    final binding = await _bindingFor(characterId, transport);
    return transport.sendMediaTurn(
      binding: binding,
      bytes: bytes,
      mimeType: mimeType,
      caption: caption,
    );
  }

  Future<AgentTurnResult> _sendMediaSetViaTransport(
    String characterId,
    String messageId,
    List<ChatAttachment> attachments, {
    required String caption,
  }) async {
    final media = <AgentMediaInput>[];
    var totalBytes = 0;
    for (final attachment in attachments) {
      final file = File(attachment.path);
      final bytes = await file.readAsBytes();
      if (bytes.isEmpty || bytes.length > 8 * 1024 * 1024) {
        throw const ApiException(
          'Each attachment must be between 1 byte and 8 MB',
          code: 'ATTACHMENT_TOO_LARGE',
        );
      }
      totalBytes += bytes.length;
      if (totalBytes > 12 * 1024 * 1024) {
        throw const ApiException(
          'Combined attachments must be 12 MB or smaller',
          code: 'ATTACHMENT_TOO_LARGE',
        );
      }
      final mimeType = attachment.kind == 'voice'
          ? 'audio/m4a'
          : lookupMimeType(
                  attachment.path,
                  headerBytes: bytes.take(16).toList(),
                ) ??
                switch (attachment.kind) {
                  'image' => 'image/jpeg',
                  'video' => 'video/mp4',
                  _ => 'application/octet-stream',
                };
      media.add(
        AgentMediaInput(
          bytes: bytes,
          mimeType: mimeType,
          name: attachment.name,
        ),
      );
    }
    final transport = ref.read(agentTransportProvider);
    final binding = await _bindingFor(characterId, transport);
    return transport.sendMediaSetTurn(
      binding: binding,
      media: media,
      caption: caption,
      onUploadProgress: (sent, total) {
        if (total <= 0) return;
        _updateMessage(
          characterId,
          messageId,
          (message) => message.copyWith(
            deliveryStatus: sent >= total ? 'processing' : 'uploading',
            uploadProgress: (sent / total).clamp(0.0, 1.0).toDouble(),
          ),
          persist: false,
        );
      },
    );
  }

  Future<AgentTurnResult> _sendViaTransport(
    String characterId,
    String prompt, {
    void Function(String delta)? onTextDelta,
  }) async {
    final transport = ref.read(agentTransportProvider);
    final binding = await _bindingFor(characterId, transport);
    return transport.sendTurn(
      binding: binding,
      text: prompt,
      onTextDelta: onTextDelta,
    );
  }

  Future<AgentSessionBinding> _bindingFor(
    String characterId,
    AgentTransport transport,
  ) async {
    final connectionGeneration = _connectionGeneration;
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    final cached = _bindings[characterId];
    final previewCached =
        cached != null && cached.characterSessionId.startsWith('preview-');
    if (cached != null &&
        previewCached == (transport is PreviewAgentTransport)) {
      return cached;
    }
    final binding = await transport.openSession(characterId);
    if (connectionGeneration != _connectionGeneration ||
        threadGeneration != (_threadGenerations[characterId] ?? 0)) {
      unawaited(transport.closeSession(binding));
      throw const ApiException('Conversation changed');
    }
    if (_disposed) return binding;
    _bindings[characterId] = binding;
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          characterSessionId: binding.characterSessionId,
        ),
      },
    );
    await _save();
    return binding;
  }

  String _beginAiStream(String characterId) {
    final thread = threadOf(characterId);
    final id = _newId();
    final isOpen = state.openThreadId == characterId;
    final message = AiChatMessage(
      id: id,
      isUser: false,
      text: '',
      createdAt: DateTime.now(),
      deliveryStatus: 'streaming',
    );
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: [...thread.messages, message],
          unread: isOpen ? 0 : thread.unread + 1,
          updatedAt: DateTime.now(),
        ),
      },
    );
    _save();
    return id;
  }

  void _appendAiDelta(String characterId, String messageId, String delta) {
    if (_disposed || delta.isEmpty) return;
    _updateMessage(
      characterId,
      messageId,
      (message) => message.copyWith(
        text: message.text + delta,
        deliveryStatus: 'streaming',
      ),
      persist: false,
    );
  }

  Future<void> _finalizeAiStream(
    String characterId,
    String messageId,
    String finalText, {
    List<AgentMessagePart> parts = const [],
    ChatAttachment? attachment,
    String? agentRunId,
  }) async {
    if (_disposed) return;
    _updateMessage(
      characterId,
      messageId,
      (message) => message.copyWith(
        text: finalText,
        parts: parts,
        attachment: attachment,
        deliveryStatus: 'delivered',
      ),
      persist: false,
    );
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          updatedAt: DateTime.now(),
          agentRunId: agentRunId,
        ),
      },
      sendingIn: {...state.sendingIn}..remove(characterId),
    );
    await _save();
  }

  void _removeStreamingPlaceholders(String characterId) {
    final thread = threadOf(characterId);
    final messages = thread.messages
        .where((message) =>
            message.isUser || message.deliveryStatus != 'streaming')
        .toList();
    if (messages.length == thread.messages.length) return;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(messages: messages),
      },
    );
  }

  Future<void> _appendAi(
    String characterId,
    String text, {
    List<AgentMessagePart> parts = const [],
    ChatAttachment? attachment,
    String? agentRunId,
  }) async {
    if (_disposed) return;
    final thread = threadOf(characterId);
    final isOpen = state.openThreadId == characterId;
    final msg = AiChatMessage(
      id: _newId(),
      isUser: false,
      text: text,
      parts: parts,
      attachment: attachment,
      createdAt: DateTime.now(),
      deliveryStatus: 'delivered',
    );
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: [...thread.messages, msg],
          unread: isOpen ? 0 : thread.unread + 1,
          updatedAt: DateTime.now(),
          agentRunId: agentRunId,
        ),
      },
      sendingIn: {...state.sendingIn}..remove(characterId),
    );
    await _save();
  }

  void seedGreeting(String characterId, String? greeting) {
    final text = greeting?.trim() ?? '';
    if (text.isEmpty) return;
    final thread = threadOf(characterId);
    if (thread.messages.isNotEmpty) return;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: [
            AiChatMessage(
              id: _newId(),
              isUser: false,
              text: text,
              createdAt: DateTime.now(),
            ),
          ],
          updatedAt: DateTime.now(),
        ),
      },
    );
    _save();
  }

  void injectScenario(
    String characterId, {
    required AgentMessagePart part,
    String text = '',
  }) {
    if (!kDebugMode) {
      throw StateError('Scenario injection is debug-only');
    }
    unawaited(_appendAi(characterId, text, parts: [part]));
  }

  void setDraft(String characterId, String value) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {...state.threads, characterId: thread.copyWith(draft: value)},
    );
    _save();
  }

  void reactToMessage(String characterId, String messageId, String? emoji) {
    _updateMessage(characterId, messageId, (m) => m.copyWith(reaction: emoji ?? ''));
  }

  void editMessage(String characterId, String messageId, String text) {
    final value = text.trim();
    if (value.isEmpty) return;
    _updateMessage(
      characterId,
      messageId,
      (m) => m.isUser && !m.deleted
          ? m.copyWith(text: value, editedAt: DateTime.now())
          : m,
    );
  }

  void deleteMessage(String characterId, String messageId) {
    _updateMessage(
      characterId,
      messageId,
      (m) => m.copyWith(
        text: '',
        deleted: true,
        deliveryStatus: 'deleted',
      ),
    );
  }

  void renameThread(String characterId, String title) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(title: title.trim().isEmpty ? null : title.trim()),
      },
    );
    _save();
  }

  void togglePin(String characterId) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {...state.threads, characterId: thread.copyWith(pinned: !thread.pinned)},
    );
    _save();
  }

  void toggleArchive(String characterId) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {...state.threads, characterId: thread.copyWith(archived: !thread.archived)},
    );
    _save();
  }

  void stopGeneration(String characterId) {
    ref.read(agentTransportProvider).cancelTurn(characterId);
    _threadGenerations[characterId] = (_threadGenerations[characterId] ?? 0) + 1;
    final thread = threadOf(characterId);
    final messages = [...thread.messages];
    for (var i = messages.length - 1; i >= 0; i--) {
      final message = messages[i];
      if (!message.isUser && message.deliveryStatus == 'streaming') {
        messages[i] = message.copyWith(deliveryStatus: 'stopped');
        continue;
      }
      if (message.isUser && message.deliveryStatus == 'sending') {
        messages[i] = message.copyWith(deliveryStatus: 'stopped');
        break;
      }
    }
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(messages: messages),
      },
      sendingIn: {...state.sendingIn}..remove(characterId),
    );
    _save();
  }

  Future<void> newContext(String characterId) async {
    _threadGenerations[characterId] = (_threadGenerations[characterId] ?? 0) + 1;
    final old = _bindings.remove(characterId);
    if (old != null) {
      unawaited(ref.read(agentTransportProvider).closeSession(old));
    }
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          characterSessionId: '',
          agentRunId: '',
        ),
      },
      sendingIn: {...state.sendingIn}..remove(characterId),
    );
    await _save();
  }

  List<AiChatMessage> searchMessages(String characterId, String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return const [];
    return threadOf(characterId)
        .messages
        .where((m) => !m.deleted && m.text.toLowerCase().contains(q))
        .toList();
  }

  void _setDelivery(String characterId, String messageId, String status) {
    _updateMessage(characterId, messageId, (m) => m.copyWith(deliveryStatus: status));
  }

  void _updateMessage(
    String characterId,
    String messageId,
    AiChatMessage Function(AiChatMessage) transform, {
    bool persist = true,
  }) {
    final thread = threadOf(characterId);
    final messages = [
      for (final m in thread.messages)
        if (m.id == messageId) ...[
          transform(m),
        ] else
          m,
    ];
    if (!thread.messages.any((m) => m.id == messageId)) return;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(messages: messages, updatedAt: DateTime.now()),
      },
    );
    if (persist) _save();
  }

  void clearThread(String characterId) {
    _threadGenerations[characterId] =
        (_threadGenerations[characterId] ?? 0) + 1;
    _bindings.remove(characterId);
    final threads = {...state.threads}..remove(characterId);
    state = state.copyWith(
      threads: threads,
      sendingIn: {...state.sendingIn}..remove(characterId),
    );
    _save();
  }

  void clearAll() {
    for (final id in state.threads.keys) {
      _threadGenerations[id] = (_threadGenerations[id] ?? 0) + 1;
    }
    _bindings.clear();
    state = state.copyWith(threads: {}, sendingIn: {});
    _save();
  }

  String _newId() => 'm-${DateTime.now().microsecondsSinceEpoch}-${_seq++}';

  Future<File?> _threadsFile() async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      return File('${dir.path}/$_kThreadsFile');
    } catch (_) {
      return null;
    }
  }

  Future<void> _load() async {
    try {
      final file = await _threadsFile();
      if (file == null || !await file.exists()) return;
      final raw = jsonDecode(await file.readAsString());
      final list = (raw as List? ?? [])
          .map((e) => ChatThread.fromJson((e as Map).cast<String, dynamic>()))
          .where((t) => t.characterId.isNotEmpty)
          .toList();
      if (_disposed || list.isEmpty) return;
      state = state.copyWith(
        threads: {for (final t in list) t.characterId: t, ...state.threads},
      );
    } catch (_) {
      // Corrupt/missing cache never prevents the user from opening chat.
    }
  }

  Future<void> _save() async {
    try {
      final file = await _threadsFile();
      if (file == null) return;
      final list = state.threads.values.map((t) => t.toJson()).toList();
      await file.writeAsString(jsonEncode(list));
    } catch (_) {
      // Local cache is best-effort. Server session/run truth is canonical.
    }
  }
}

final aiChatProvider = NotifierProvider<AiChatController, AiChatState>(
  AiChatController.new,
);
