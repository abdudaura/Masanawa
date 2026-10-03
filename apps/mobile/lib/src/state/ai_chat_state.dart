import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../agents/agent_session.dart';
import '../chat/masana.dart';
import '../core/providers.dart';

const String _kThreadsFile = 'masanawa_threads_v1.json';

/// A file, photo or voice note attached to a message. Paths point at files on
/// this device (picked via the composer); nothing leaves the phone until the
/// AI backend endpoint ships.
class ChatAttachment {
  const ChatAttachment({
    required this.kind,
    required this.path,
    this.name,
    this.sizeBytes,
    this.durationMs,
  });

  /// One of `image`, `doc`, `voice`.
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

/// One row in a Masana thread.
class AiChatMessage {
  const AiChatMessage({
    required this.id,
    required this.isUser,
    required this.text,
    required this.createdAt,
    this.attachment,
  });

  final String id;
  final bool isUser;
  final String text;
  final DateTime createdAt;
  final ChatAttachment? attachment;

  Map<String, dynamic> toJson() => {
        'id': id,
        'isUser': isUser,
        'text': text,
        'createdAt': createdAt.toIso8601String(),
        if (attachment != null) 'attachment': attachment!.toJson(),
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
      );
}

/// One conversation — exactly one per Masana, like one chat per contact.
///
/// `characterSessionId` / `agentRunId` are future Masanawa runtime bindings
/// (U-SHELL-05). Today they are always null: the thread is a local preview
/// cache and the server remains the truth when pairing ships. Older caches
/// without these keys still load.
class ChatThread {
  ChatThread({
    required this.masanaId,
    this.messages = const [],
    this.unread = 0,
    DateTime? updatedAt,
    this.characterSessionId,
    this.agentRunId,
  }) : updatedAt = updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0);

  final String masanaId;
  final List<AiChatMessage> messages;
  final int unread;
  final DateTime updatedAt;

  /// Future CharacterSession binding (server truth). Null until paired.
  final String? characterSessionId;

  /// Future AgentRun binding (server truth). Null until runtime ships.
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
        masanaId: masanaId,
        messages: messages ?? this.messages,
        unread: unread ?? this.unread,
        updatedAt: updatedAt ?? this.updatedAt,
        characterSessionId: characterSessionId ?? this.characterSessionId,
        agentRunId: agentRunId ?? this.agentRunId,
      );

  Map<String, dynamic> toJson() => {
        'masanaId': masanaId,
        'messages': [for (final m in messages) m.toJson()],
        'unread': unread,
        'updatedAt': updatedAt.toIso8601String(),
        if (characterSessionId != null)
          'characterSessionId': characterSessionId,
        if (agentRunId != null) 'agentRunId': agentRunId,
      };

  factory ChatThread.fromJson(Map<String, dynamic> json) => ChatThread(
        masanaId: json['masanaId'] as String? ?? 'masanawa',
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

class AiChatState {
  const AiChatState({
    this.threads = const {},
    this.sendingIn = const {},
    this.openThreadId,
  });

  final Map<String, ChatThread> threads;
  final Set<String> sendingIn;
  final String? openThreadId;

  /// Threads with at least one message, newest first — the chat list.
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

/// All Masana conversations.
///
/// Sends go through the active [AgentTransport]: the live Masanawa runtime
/// when the build points at one, otherwise the civic preview endpoint.
/// Any transport failure falls back to an honest on-device reply — the UI
/// never fakes a brain that is not connected.
class AiChatController extends Notifier<AiChatState> {
  int _seq = 0;
  bool _disposed = false;

  /// In-memory server bindings, one per Masana. Never persisted: sessions
  /// are server truth and re-opened (resumed) on every app launch.
  final Map<String, AgentSessionBinding> _bindings = {};

  /// Pinned once a live runtime proves unreachable, so later turns skip
  /// straight to preview instead of timing out one by one.
  bool _runtimeDown = false;

  @override
  AiChatState build() {
    scheduleMicrotask(_load);
    ref.onDispose(() => _disposed = true);
    return const AiChatState();
  }

  bool sendingIn(String masanaId) => state.sendingIn.contains(masanaId);

  ChatThread threadOf(String masanaId) =>
      state.threads[masanaId] ?? ChatThread(masanaId: masanaId);

  void openThread(String masanaId) {
    final thread = threadOf(masanaId);
    state = state.copyWith(
      threads: {...state.threads, masanaId: thread.copyWith(unread: 0)},
      openThreadId: masanaId,
    );
    _save();
  }

  void closeThread() {
    state = state.copyWith(clearOpen: true);
  }

  Future<void> sendText(String masanaId, String rawText) async {
    final text = rawText.trim();
    if (text.isEmpty || state.sendingIn.contains(masanaId)) return;
    await _dispatchUserMessage(
      masanaId,
      AiChatMessage(
        id: _newId(),
        isUser: true,
        text: text,
        createdAt: DateTime.now(),
      ),
    );
  }

  Future<void> sendAttachment(
    String masanaId,
    ChatAttachment attachment, {
    String? caption,
  }) async {
    if (state.sendingIn.contains(masanaId)) return;
    await _dispatchUserMessage(
      masanaId,
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
      String masanaId, AiChatMessage userMsg) async {
    final thread = threadOf(masanaId);
    final now = DateTime.now();
    state = state.copyWith(
      threads: {
        ...state.threads,
        masanaId: thread.copyWith(
          messages: [...thread.messages, userMsg],
          updatedAt: now,
        ),
      },
      sendingIn: {...state.sendingIn, masanaId},
    );
    await _save();
    try {
      final masana = masanaById(masanaId);
      final prompt = userMsg.text.isEmpty
          ? '[${userMsg.attachment?.label ?? 'attachment'}]'
          : userMsg.text;
      final result = await _sendViaTransport(masanaId, prompt);
      _appendAi(masanaId, result.text, agentRunId: result.agentRunId);
    } catch (_) {
      _appendAi(masanaId, _fallbackReply(masanaId, userMsg));
    }
  }

  /// Sends one turn through the live runtime when configured, otherwise
  /// through preview. A dead runtime pins preview for the rest of this app
  /// lifetime and retries the turn once through it.
  Future<AgentTurnResult> _sendViaTransport(
    String masanaId,
    String prompt,
  ) async {
    final primary =
        _runtimeDown ? _previewTransport() : ref.read(agentTransportProvider);
    try {
      final binding = await _bindingFor(masanaId, primary);
      return await primary.sendTurn(binding: binding, text: prompt);
    } catch (_) {
      // Preview failures carry no runtime to fall back to.
      if (primary is PreviewAgentTransport) rethrow;
      _runtimeDown = true;
      final preview = _previewTransport();
      final binding = await _bindingFor(masanaId, preview);
      return preview.sendTurn(binding: binding, text: prompt);
    }
  }

  AgentTransport _previewTransport() => PreviewAgentTransport(
        sendPreview: (message, masana) =>
            ref.read(apiClientProvider).aiChat(message, masana: masana),
      );

  /// Returns the cached server binding for [masanaId], opening (resuming)
  /// the session when there is none. Preview bindings are ephemeral markers;
  /// runtime bindings are server truth.
  Future<AgentSessionBinding> _bindingFor(
    String masanaId,
    AgentTransport transport,
  ) async {
    final cached = _bindings[masanaId];
    final previewCached =
        cached != null && cached.characterSessionId.startsWith('preview-');
    if (cached != null && previewCached == (transport is PreviewAgentTransport)) {
      return cached;
    }
    final binding = await transport.openSession(masanaId);
    _bindings[masanaId] = binding;
    return binding;
  }

  void _appendAi(String masanaId, String text, {String? agentRunId}) {
    if (_disposed) return;
    final thread = threadOf(masanaId);
    final isOpen = state.openThreadId == masanaId;
    final msg = AiChatMessage(
      id: _newId(),
      isUser: false,
      text: text,
      createdAt: DateTime.now(),
    );
    final sending = {...state.sendingIn}..remove(masanaId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        masanaId: thread.copyWith(
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

  /// Seeds the Masana greeting the first time a thread opens.
  void ensureGreeting(String masanaId) {
    final thread = threadOf(masanaId);
    if (thread.messages.isNotEmpty) return;
    final msg = AiChatMessage(
      id: _newId(),
      isUser: false,
      text: masanaById(masanaId).greeting,
      createdAt: DateTime.now(),
    );
    state = state.copyWith(
      threads: {
        ...state.threads,
        masanaId: thread.copyWith(
          messages: [msg],
          updatedAt: DateTime.now(),
        ),
      },
    );
    _save();
  }

  /// Removes one conversation from the chat list.
  void clearThread(String masanaId) {
    final threads = {...state.threads}..remove(masanaId);
    state = state.copyWith(threads: threads);
    _save();
  }

  /// Removes every conversation.
  void clearAll() {
    state = state.copyWith(threads: {});
    _save();
  }

  String _newId() =>
      'm-${DateTime.now().microsecondsSinceEpoch}-${_seq++}';

  /// Honest on-device reply until the `/ai/chat` backend endpoint ships.
  String _fallbackReply(String masanaId, AiChatMessage userMsg) {
    final masana = masanaById(masanaId);
    final buffer = StringBuffer('I am ${masana.name} (preview mode — my full '
        'brain is not connected yet).\n\n');
    if (userMsg.attachment != null) {
      buffer.write('I got your ${userMsg.attachment!.label}. ');
    }
    if (userMsg.text.isNotEmpty) {
      buffer.write('You said: "${userMsg.text}"\n\n');
    }
    buffer.write('Ask me anything and I will help once I am fully connected.');
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
          .toList();
      if (_disposed || list.isEmpty) return;
      state = state.copyWith(
        threads: {for (final t in list) t.masanaId: t},
      );
    } catch (_) {
      // Corrupt or missing cache — start fresh, never crash the chat.
    }
  }

  Future<void> _save() async {
    try {
      final file = await _threadsFile();
      if (file == null) return;
      final list = state.threads.values.map((t) => t.toJson()).toList();
      await file.writeAsString(jsonEncode(list));
    } catch (_) {
      // Persistence is best-effort; the live chat never blocks on it.
    }
  }
}

final aiChatProvider =
    NotifierProvider<AiChatController, AiChatState>(AiChatController.new);
