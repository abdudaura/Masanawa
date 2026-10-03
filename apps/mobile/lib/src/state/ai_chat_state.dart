import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:mime/mime.dart';

import '../agents/agent_session.dart';
import '../chat/chat_format.dart';
import '../chat/message_parts.dart';
import '../core/providers.dart';
import '../core/alpha_speech.dart';

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
    this.parts = const [],
  });

  final String id;
  final bool isUser;
  final String text;
  final DateTime createdAt;
  final ChatAttachment? attachment;
  final List<AgentMessagePart> parts;

  Map<String, dynamic> toJson() => {
        'id': id,
        'isUser': isUser,
        'text': text,
        'createdAt': createdAt.toIso8601String(),
        if (attachment != null) 'attachment': attachment!.toJson(),
        if (parts.isNotEmpty) 'parts': [for (final part in parts) part.toJson()],
      };

  factory AiChatMessage.fromJson(Map<String, dynamic> json) => AiChatMessage(
        id: json['id'] as String? ?? '',
        isUser: json['isUser'] as bool? ?? false,
        text: json['text'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
        attachment: json['attachment'] == null
            ? null
            : ChatAttachment.fromJson(
                (json['attachment'] as Map).cast<String, dynamic>()),
        parts: [
          for (final raw in (json['parts'] as List? ?? const []))
            if (raw is Map)
              AgentMessagePart.fromJson(raw.cast<String, dynamic>()),
        ],
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
  }) : updatedAt = updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0);

  final String characterId;
  final List<AiChatMessage> messages;
  final int unread;
  final DateTime updatedAt;
  final String? characterSessionId;
  final String? agentRunId;

  AiChatMessage? get lastMessage =>
      messages.isEmpty ? null : messages.last;

  ChatThread copyWith({
    List<AiChatMessage>? messages,
    int? unread,
    DateTime? updatedAt,
    String? characterSessionId,
    String? agentRunId,
  }) =>
      ChatThread(
        characterId: characterId,
        messages: messages ?? this.messages,
        unread: unread ?? this.unread,
        updatedAt: updatedAt ?? this.updatedAt,
        characterSessionId: characterSessionId ?? this.characterSessionId,
        agentRunId: agentRunId ?? this.agentRunId,
      );

  Map<String, dynamic> toJson() => {
        'characterId': characterId,
        'messages': [for (final m in messages) m.toJson()],
        'unread': unread,
        'updatedAt': updatedAt.toIso8601String(),
        if (characterSessionId != null)
          'characterSessionId': characterSessionId,
        if (agentRunId != null) 'agentRunId': agentRunId,
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
    final list =
        threads.values.where((t) => t.messages.isNotEmpty).toList();
    list.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  int get totalUnread =>
      threads.values.fold(0, (sum, t) => sum + t.unread);

  AiChatState copyWith({
    Map<String, ChatThread>? threads,
    Set<String>? sendingIn,
    String? openThreadId,
    bool clearOpen = false,
  }) =>
      AiChatState(
        threads: threads ?? this.threads,
        sendingIn: sendingIn ?? this.sendingIn,
        openThreadId: clearOpen ? null : (openThreadId ?? this.openThreadId),
      );
}

class AiChatController extends Notifier<AiChatState> {
  int _seq = 0;
  bool _disposed = false;
  final Map<String, AgentSessionBinding> _bindings = {};
  bool _runtimeDown = false;

  @override
  AiChatState build() {
    scheduleMicrotask(_load);
    ref.onDispose(() => _disposed = true);
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
  }

  void closeThread() => state = state.copyWith(clearOpen: true);

  Future<void> sendText(String characterId, String rawText) async {
    final text = rawText.trim();
    if (text.isEmpty || state.sendingIn.contains(characterId)) return;
    await _dispatchUserMessage(
      characterId,
      AiChatMessage(
        id: _newId(),
        isUser: true,
        text: text,
        createdAt: DateTime.now(),
      ),
    );
  }

  Future<void> sendAttachment(
    String characterId,
    ChatAttachment attachment, {
    String? caption,
  }) async {
    if (state.sendingIn.contains(characterId)) return;
    await _dispatchUserMessage(
      characterId,
      AiChatMessage(
        id: _newId(),
        isUser: true,
        text: (caption ?? '').trim(),
        createdAt: DateTime.now(),
        attachment: attachment,
      ),
    );
  }

  Future<void> _dispatchUserMessage(
    String characterId,
    AiChatMessage userMsg,
  ) async {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: [...thread.messages, userMsg],
          updatedAt: DateTime.now(),
        ),
      },
      sendingIn: {...state.sendingIn, characterId},
    );
    await _save();
    try {
      final attachment = userMsg.attachment;
      final result = attachment == null
          ? await _sendViaTransport(characterId, userMsg.text)
          : await _sendMediaViaTransport(
              characterId,
              attachment,
              caption: userMsg.text,
            );
      _appendAi(
        characterId,
        result.text,
        parts: result.parts,
        agentRunId: result.agentRunId,
      );
      unawaited(AlphaSpeech.speak(result.text));
    } catch (_) {
      _appendAi(characterId, _fallbackReply(userMsg));
    }
  }


  Future<AgentTurnResult> _sendMediaViaTransport(
    String characterId,
    ChatAttachment attachment, {
    required String caption,
  }) async {
    final file = File(attachment.path);
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || bytes.length > 8 * 1024 * 1024) {
      throw const ApiException('Attachment must be between 1 byte and 8 MB');
    }
    final mimeType = lookupMimeType(
          attachment.path,
          headerBytes: bytes.take(16).toList(),
        ) ??
        switch (attachment.kind) {
          'voice' => 'audio/mp4',
          'image' => 'image/jpeg',
          _ => 'application/octet-stream',
        };

    final primary =
        _runtimeDown ? _previewTransport() : ref.read(agentTransportProvider);
    try {
      final binding = await _bindingFor(characterId, primary);
      return await primary.sendMediaTurn(
        binding: binding,
        bytes: bytes,
        mimeType: mimeType,
        caption: caption,
      );
    } catch (_) {
      if (primary is PreviewAgentTransport) rethrow;
      _runtimeDown = true;
      final preview = _previewTransport();
      final binding = await _bindingFor(characterId, preview);
      return preview.sendMediaTurn(
        binding: binding,
        bytes: bytes,
        mimeType: mimeType,
        caption: caption,
      );
    }
  }

  Future<AgentTurnResult> _sendViaTransport(
    String characterId,
    String prompt,
  ) async {
    final primary =
        _runtimeDown ? _previewTransport() : ref.read(agentTransportProvider);
    try {
      final binding = await _bindingFor(characterId, primary);
      return await primary.sendTurn(binding: binding, text: prompt);
    } catch (_) {
      if (primary is PreviewAgentTransport) rethrow;
      _runtimeDown = true;
      final preview = _previewTransport();
      final binding = await _bindingFor(characterId, preview);
      return preview.sendTurn(binding: binding, text: prompt);
    }
  }

  AgentTransport _previewTransport() => PreviewAgentTransport(
        sendPreview: (message, characterId) =>
            ref.read(apiClientProvider).aiChat(
                  message,
                  masana: characterId,
                ),
      );

  Future<AgentSessionBinding> _bindingFor(
    String characterId,
    AgentTransport transport,
  ) async {
    final cached = _bindings[characterId];
    final previewCached =
        cached != null && cached.characterSessionId.startsWith('preview-');
    if (cached != null &&
        previewCached == (transport is PreviewAgentTransport)) {
      return cached;
    }
    final binding = await transport.openSession(characterId);
    _bindings[characterId] = binding;
    return binding;
  }

  void _appendAi(
    String characterId,
    String text, {
    List<AgentMessagePart> parts = const [],
    String? agentRunId,
  }) {
    if (_disposed) return;
    final thread = threadOf(characterId);
    final isOpen = state.openThreadId == characterId;
    final msg = AiChatMessage(
      id: _newId(),
      isUser: false,
      text: text,
      parts: parts,
      createdAt: DateTime.now(),
    );
    final sending = {...state.sendingIn}..remove(characterId);
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
      sendingIn: sending,
    );
    _save();
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
    _appendAi(
      characterId,
      text,
      parts: [part],
    );
  }

  void clearThread(String characterId) {
    final threads = {...state.threads}..remove(characterId);
    state = state.copyWith(threads: threads);
    _save();
  }

  void clearAll() {
    state = state.copyWith(threads: {});
    _save();
  }

  String _newId() =>
      'm-${DateTime.now().microsecondsSinceEpoch}-${_seq++}';

  String _fallbackReply(AiChatMessage userMsg) {
    final buffer = StringBuffer(
      'The live Masanawa agent runtime is unavailable right now. ',
    );
    if (userMsg.attachment != null) {
      buffer.write('Your ${userMsg.attachment!.label} is still on this device. ');
    }
    buffer.write('I have kept this conversation locally so you can retry.');
    return buffer.toString();
  }

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
        threads: {for (final t in list) t.characterId: t},
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

final aiChatProvider =
    NotifierProvider<AiChatController, AiChatState>(AiChatController.new);
