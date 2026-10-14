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
import '../core/live_pcm_audio.dart';
import '../core/agent_audio_attachment.dart';
import '../core/network/api_client.dart';
import '../core/request_id.dart';
import '../agents/agent_shell.dart';
import '../core/mobile_push.dart';
import '../core/startup_metrics.dart';
import '../chat/shell_action_coordinator.dart';
import '../chat/shell_action_journal.dart';
import '../chat/shell_document.dart';
import '../chat/shell_secure_storage.dart';
import 'session_state.dart';
import 'agent_directory_state.dart';

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
    this.waveform = const [],
  });

  final String kind;
  final String path;
  final String? name;
  final int? sizeBytes;
  final int? durationMs;
  final List<double> waveform;

  String get label => switch (kind) {
    'image' => '📷 Photo',
    'voice' => '🎤 Voice note (${formatDurationMs(durationMs ?? 0)})',
    'video' => '🎬 ${name ?? 'Video'}',
    _ => '📄 ${name ?? 'Document'}',
  };

  Map<String, dynamic> toJson() => {
    'kind': kind,
    'path': path,
    if (name != null) 'name': name,
    if (sizeBytes != null) 'sizeBytes': sizeBytes,
    if (durationMs != null) 'durationMs': durationMs,
    if (waveform.isNotEmpty) 'waveform': waveform,
  };

  factory ChatAttachment.fromJson(Map<String, dynamic> json) => ChatAttachment(
    kind: json['kind'] as String? ?? 'doc',
    path: json['path'] as String? ?? '',
    name: json['name'] as String?,
    sizeBytes: json['sizeBytes'] as int?,
    durationMs: json['durationMs'] as int?,
    waveform: [
      for (final value in (json['waveform'] as List? ?? const []))
        if (value is num) value.toDouble().clamp(0.0, 1.0).toDouble(),
    ],
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
    this.requestId,
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
  final String? requestId;

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
    String? requestId,
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
    requestId: requestId ?? this.requestId,
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
    if (requestId != null) 'requestId': requestId,
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
    requestId: json['requestId'] as String?,
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
    this.scrollOffset = 0,
    this.draftAttachments = const [],
    this.draftVoice,
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
  final double scrollOffset;
  final List<ChatAttachment> draftAttachments;
  final ChatAttachment? draftVoice;

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
    double? scrollOffset,
    List<ChatAttachment>? draftAttachments,
    ChatAttachment? draftVoice,
    bool clearDraftVoice = false,
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
    scrollOffset: scrollOffset ?? this.scrollOffset,
    draftAttachments: draftAttachments ?? this.draftAttachments,
    draftVoice: clearDraftVoice ? null : (draftVoice ?? this.draftVoice),
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
    if (scrollOffset > 0) 'scrollOffset': scrollOffset,
    if (draftAttachments.isNotEmpty)
      'draftAttachments': [for (final item in draftAttachments) item.toJson()],
    if (draftVoice != null) 'draftVoice': draftVoice!.toJson(),
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
      scrollOffset: (json['scrollOffset'] as num?)?.toDouble() ?? 0,
      draftAttachments: [
        for (final raw in (json['draftAttachments'] as List? ?? const []))
          if (raw is Map) ChatAttachment.fromJson(raw.cast<String, dynamic>()),
      ],
      draftVoice: json['draftVoice'] is Map
          ? ChatAttachment.fromJson(
              (json['draftVoice'] as Map).cast<String, dynamic>(),
            )
          : null,
    );
  }
}

class AiChatState {
  const AiChatState({
    this.threads = const {},
    this.sendingIn = const {},
    this.openThreadId,
    this.online = true,
    this.shellConfigs = const {},
  });

  final Map<String, ChatThread> threads;
  final Set<String> sendingIn;
  final String? openThreadId;
  final bool online;
  final Map<String, AgentShellConfig> shellConfigs;

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
    bool? online,
    Map<String, AgentShellConfig>? shellConfigs,
  }) => AiChatState(
    threads: threads ?? this.threads,
    sendingIn: sendingIn ?? this.sendingIn,
    openThreadId: clearOpen ? null : (openThreadId ?? this.openThreadId),
    online: online ?? this.online,
    shellConfigs: shellConfigs ?? this.shellConfigs,
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
  final Map<String, StreamSubscription<AgentShellEvent>> _eventSubscriptions = {};
  final Map<String, String> _eventCursors = {};
  final Map<String, ShellActionCoordinator> _actionCoordinators = {};
  final Map<String, EncryptedShellActionJournal> _actionJournals = {};
  String? _cacheOwnerId;
  int _cacheGeneration = 0;
  Future<Directory?>? _documentsDirectoryFuture;

  @override
  AiChatState build() {
    final initialSession = ref.read(sessionProvider);
    _cacheOwnerId =
        initialSession is SessionSignedIn ? initialSession.user.id : null;
    final initialOwner = _cacheOwnerId;
    if (initialOwner != null && initialOwner.isNotEmpty) {
      // Local conversation state is useful immediately. Hydrate it before
      // starting another platform-channel dependency on slower devices.
      unawaited(
        _load(initialOwner, _cacheGeneration)
            .whenComplete(_startConnectivityMonitoring),
      );
    } else {
      scheduleMicrotask(_startConnectivityMonitoring);
    }
    ref.onDispose(() {
      _disposed = true;
      _connectivitySub?.cancel();
      for (final subscription in _eventSubscriptions.values) {
        unawaited(subscription.cancel());
      }
      _eventSubscriptions.clear();
    });
    ref.listen(sessionProvider, (previous, next) {
      final nextOwner = next is SessionSignedIn ? next.user.id : null;
      if (nextOwner == _cacheOwnerId) return;
      final previousOwner = _cacheOwnerId;
      _cacheOwnerId = nextOwner;
      final generation = ++_cacheGeneration;
      unawaited(_handleOwnerChange(previousOwner, nextOwner, generation));
    });
    ref.listen(agentTransportProvider, (previous, _) {
      _connectionGeneration++;
      final bindings = [..._bindings.values];
      _bindings.clear();
      if (previous != null) {
        for (final binding in bindings) {
          unawaited(previous.closeSession(binding).catchError((_) {}));
        }
      }
      for (final subscription in _eventSubscriptions.values) {
        unawaited(subscription.cancel());
      }
      _eventSubscriptions.clear();
      _actionCoordinators.clear();
      _eventCursors.clear();
      state = state.copyWith(shellConfigs: {});
    });
    return const AiChatState();
  }

  void _startConnectivityMonitoring() {
    if (_disposed || _connectivitySub != null) return;
    try {
      _connectivitySub = Connectivity().onConnectivityChanged.listen(
        (results) {
          final online = !results.contains(ConnectivityResult.none);
          if (!_disposed) state = state.copyWith(online: online);
          if (online) {
            unawaited(_flushQueuedMessages());
            final open = state.openThreadId;
            if (open != null) unawaited(syncFromServer(open));
          }
        },
        onError: (_) {},
      );
    } catch (_) {}
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
    unawaited(syncFromServer(characterId));
  }

  void closeThread() => state = state.copyWith(clearOpen: true);

  AgentShellTransport? get _shellTransport {
    final transport = ref.read(agentTransportProvider);
    return transport is AgentShellTransport
        ? transport as AgentShellTransport
        : null;
  }

  Future<void> syncFromServer(String characterId) async {
    final transport = _shellTransport;
    final generation = _connectionGeneration;
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    if (transport == null || await _offlineNow()) return;
    if (_disposed || generation != _connectionGeneration) return;
    try {
      final results = await Future.wait<dynamic>([
        transport.loadShellConfig(characterId),
        transport.loadHistory(characterId, limit: 100),
      ]);
      if (_disposed || generation != _connectionGeneration ||
          threadGeneration != (_threadGenerations[characterId] ?? 0)) return;
      final config = results[0] as AgentShellConfig;
      final history = results[1] as List<AgentHistoryMessage>;
      state = state.copyWith(
        shellConfigs: {...state.shellConfigs, characterId: config},
      );
      _mergeServerHistory(characterId, history);
      await _reconcilePendingTurns(characterId, transport);
      if (_disposed || generation != _connectionGeneration ||
          threadGeneration != (_threadGenerations[characterId] ?? 0)) return;
      _startEventStream(characterId, transport);
      if (state.openThreadId == characterId) {
        unawaited(MobilePushService.instance
            .registerForCharacter(transport, characterId).catchError((_) {}));
      }
    } catch (_) {
      // A cached conversation remains usable while the canonical service is unavailable.
    }
  }

  void _mergeServerHistory(
    String characterId,
    List<AgentHistoryMessage> history,
  ) {
    final thread = threadOf(characterId);
    final local = [...thread.messages];
    final byKey = <String, AiChatMessage>{};
    for (final message in local) {
      final requestId = message.requestId;
      if (requestId != null) {
        byKey['${message.isUser ? 'user' : 'assistant'}:$requestId'] = message;
      }
    }
    for (final item in history) {
      final existing = byKey[item.key];
      final parsedParts = [
        for (final raw in item.parts)
          AgentMessagePart.fromJson(raw),
      ];
      final restored = AiChatMessage(
        id: existing?.id ?? 'server-${item.key}',
        isUser: item.direction == 'user',
        text: item.text,
        createdAt: item.createdAt,
        attachment: existing?.attachment,
        attachments: existing?.attachments ?? const [],
        parts: parsedParts.isEmpty ? (existing?.parts ?? const []) : parsedParts,
        replyToId: existing?.replyToId,
        replyPreview: existing?.replyPreview,
        reaction: existing?.reaction,
        editedAt: existing?.editedAt,
        deleted: existing?.deleted ?? false,
        deliveryStatus: 'delivered',
        requestId: item.requestId,
      );
      byKey[item.key] = restored;
    }
    final unkeyed = local.where((m) => m.requestId == null).toList();
    final merged = [...byKey.values, ...unkeyed]
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: List.unmodifiable(merged),
          updatedAt: merged.isEmpty ? thread.updatedAt : merged.last.createdAt,
        ),
      },
    );
    unawaited(_save());
  }

  Future<void> _reconcilePendingTurns(
    String characterId,
    AgentShellTransport transport,
  ) async {
    final generation = _connectionGeneration;
    final thread = threadOf(characterId);
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    for (final message in thread.messages.where(
      (m) => m.isUser &&
          m.requestId != null &&
          {'sending', 'sent', 'uploading', 'queued', 'processing', 'failed'}
               .contains(m.deliveryStatus),
    )) {
      try {
        final status = await transport.turnStatus(characterId, message.requestId!);
        if (_disposed || generation != _connectionGeneration ||
            threadGeneration != (_threadGenerations[characterId] ?? 0)) return;
        if (status.state == 'completed') {
          _setDelivery(characterId, message.id, 'delivered');
          final assistantExists = threadOf(characterId).messages.any(
            (m) => !m.isUser && m.requestId == message.requestId,
          );
          if (!assistantExists) {
            await _appendAi(
              characterId,
              status.reply ?? '',
              parts: [
                for (final raw in status.parts) AgentMessagePart.fromJson(raw),
              ],
              agentRunId: status.agentRunId,
              requestId: message.requestId,
            );
          }
        } else if (status.state == 'pending') {
          _setDelivery(characterId, message.id, 'processing');
        } else if (status.state == 'failed') {
          _setDelivery(characterId, message.id, 'failed');
        }
      } catch (_) {}
    }
  }

  void _startEventStream(
    String characterId,
    AgentShellTransport transport,
  ) {
    final generation = _connectionGeneration;
    if (_eventSubscriptions.containsKey(characterId)) return;
    _eventSubscriptions[characterId] = transport
        .events(characterId, after: _eventCursors[characterId])
        .listen(
      (event) {
        if (_disposed || generation != _connectionGeneration) return;
        if (event.cursor.isNotEmpty) _eventCursors[characterId] = event.cursor;
        _applyShellEvent(characterId, event);
      },
      onError: (_) {
        if (_disposed || generation != _connectionGeneration) return;
        _eventSubscriptions.remove(characterId);
        if (!_disposed && state.online) {
          Future<void>.delayed(
            const Duration(seconds: 2),
            () {
              if (!_disposed && generation == _connectionGeneration) {
                unawaited(syncFromServer(characterId));
              }
            },
          );
        }
      },
      onDone: () {
        if (_disposed || generation != _connectionGeneration) return;
        _eventSubscriptions.remove(characterId);
        if (!_disposed && state.online) {
          Future<void>.delayed(
            const Duration(milliseconds: 400),
            () {
              if (!_disposed && generation == _connectionGeneration) {
                unawaited(syncFromServer(characterId));
              }
            },
          );
        }
      },
    );
  }

  void _applyShellEvent(String characterId, AgentShellEvent event) {
    if (event.type == 'turn.completed' || event.type == 'turn.failed') {
      final transport = _shellTransport;
      if (transport != null) {
        unawaited(_reconcilePendingTurns(characterId, transport));
      }
      return;
    }
    if (event.type == 'presence.updated') {
      unawaited(ref.read(agentDirectoryProvider.notifier).refresh());
      return;
    }

    Map<String, dynamic>? rawDocument;
    if (event.type == 'shell.action.updated') {
      final result = event.payload['result'];
      if (result is Map && result['document'] is Map) {
        rawDocument =
            (result['document'] as Map).cast<String, dynamic>();
      }
    } else if (event.type == 'shell.document.updated' &&
        event.payload['document'] is Map) {
      rawDocument =
          (event.payload['document'] as Map).cast<String, dynamic>();
    }
    if (rawDocument != null) {
      ShellDocument document;
      try {
        document = ShellDocument.fromJson(rawDocument);
      } catch (_) {
        return;
      }
      _replaceShellDocument(characterId, document);
      return;
    }

    if (event.type == 'work.updated' || event.type == 'approval.updated') {
      final rawPart = event.payload['part'];
      final referenceId = event.payload['referenceId'];
      if (rawPart is! Map || referenceId is! String || referenceId.isEmpty) {
        return;
      }
      AgentMessagePart part;
      try {
        part = AgentMessagePart.fromJson(rawPart.cast<String, dynamic>());
      } catch (_) {
        return;
      }
      final thread = threadOf(characterId);
      var changed = false;
      final messages = [
        for (final message in thread.messages)
          message.copyWith(
            parts: [
              for (final existing in message.parts)
                if (existing.referenceId == referenceId) ...[
                  (() {
                    changed = true;
                    return part;
                  })(),
                ] else
                  existing,
            ],
          ),
      ];
      if (!changed) {
        final index = messages.lastIndexWhere((message) => !message.isUser);
        if (index >= 0) {
          messages[index] = messages[index].copyWith(
            parts: [...messages[index].parts, part],
          );
          changed = true;
        }
      }
      if (changed) {
        state = state.copyWith(
          threads: {
            ...state.threads,
            characterId: thread.copyWith(
              messages: messages,
              updatedAt: DateTime.now(),
            ),
          },
        );
        unawaited(_save());
      }
    }
  }

  void _replaceShellDocument(
    String characterId,
    ShellDocument document,
  ) {
    final thread = threadOf(characterId);
    var changed = false;
    final messages = [
      for (final message in thread.messages)
        message.copyWith(
          parts: [
            for (final part in message.parts)
              if (part.document?.id == document.id) ...[
                (() {
                  changed = true;
                  return part.copyWith(document: document);
                })(),
              ] else
                part,
          ],
        ),
    ];
    if (!changed) return;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: messages,
          updatedAt: DateTime.now(),
        ),
      },
    );
    unawaited(_save());
  }

  Future<void> submitShellAction(
    String characterId,
    ShellAction action,
  ) async {
    final transport = _shellTransport;
    if (transport == null) throw StateError('Shell actions unavailable');
    final binding = await _bindingFor(characterId, ref.read(agentTransportProvider));
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn || session.user.id.isEmpty) {
      throw StateError('Authentication required for shell actions');
    }
    final namespace = EncryptedShellActionJournal.namespaceForOwnerSession(
      ownerId: session.user.id,
      sessionId: binding.characterSessionId,
    );
    var coordinator = _actionCoordinators[namespace];
    if (coordinator == null) {
      final journal = EncryptedShellActionJournal(
        store: const FlutterShellEncryptedStore(),
        namespace: namespace,
      );
      _actionJournals[namespace] = journal;
      coordinator = ShellActionCoordinator(
        scope: namespace,
        journal: journal,
        dispatcher: TransportShellActionDispatcher(
          transport: transport,
          characterId: characterId,
          characterSessionId: binding.characterSessionId,
        ),
      );
      _actionCoordinators[namespace] = coordinator;
    }
    await coordinator.submit(action);
  }

  Future<void> clearSecureShellState({String? ownerId}) async {
    final session = ref.read(sessionProvider);
    final userId = ownerId ??
        (session is SessionSignedIn ? session.user.id : null);
    final journals = [..._actionJournals.values];
    _actionJournals.clear();
    _actionCoordinators.clear();
    for (final journal in journals) {
      await journal.clearAndClose().catchError((_) {});
    }
    if (userId != null && userId.isNotEmpty) {
      await EncryptedShellActionJournal.clearOwner(
        store: const FlutterShellEncryptedStore(),
        ownerId: userId,
      ).catchError((_) {});
    }
  }

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

  /// Executes an internal conversational turn in the same Character session
  /// without adding the orchestration prompt or response to the visible chat.
  Future<String> runInternalText(String characterId, String prompt) async {
    final text = prompt.trim();
    if (text.isEmpty) throw ArgumentError.value(prompt, 'prompt');
    if (state.sendingIn.contains(characterId)) {
      throw StateError('A conversation turn is already in progress');
    }
    if (await _offlineNow()) {
      throw const ApiException('Connect to the internet to complete setup');
    }
    final result = await _sendViaTransport(
      characterId,
      text,
      requestId: createRequestId(),
    );
    return result.text.trim();
  }

  Future<void> sendText(
    String characterId,
    String rawText, {
    String? replyToId,
    String? replyPreview,
    String? transportPrompt,
  }) async {
    final text = rawText.trim();
    if (text.isEmpty || state.sendingIn.contains(characterId)) return;
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    final message = AiChatMessage(
      id: _newId(),
      isUser: true,
      text: text,
      createdAt: DateTime.now(),
      replyToId: replyToId,
      replyPreview: replyPreview,
      deliveryStatus: 'sending',
      requestId: createRequestId(),
    );
    final offline = await _offlineNow();
    if (_disposed ||
        threadGeneration != (_threadGenerations[characterId] ?? 0)) {
      return;
    }
    if (offline) {
      await _enqueueMessage(characterId, message);
      return;
    }
    await _dispatchUserMessage(
      characterId,
      message,
      transportPrompt: transportPrompt,
    );
  }

  Future<void> sendAttachment(
    String characterId,
    ChatAttachment attachment, {
    String? caption,
    String? replyToId,
    String? replyPreview,
  }) async {
    if (state.sendingIn.contains(characterId)) return;
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    final message = AiChatMessage(
      id: _newId(),
      isUser: true,
      text: (caption ?? '').trim(),
      createdAt: DateTime.now(),
      attachment: attachment,
      replyToId: replyToId,
      replyPreview: replyPreview,
      deliveryStatus: 'sending',
      requestId: createRequestId(),
    );
    final offline = await _offlineNow();
    if (_disposed ||
        threadGeneration != (_threadGenerations[characterId] ?? 0)) {
      return;
    }
    if (offline) {
      await _enqueueMessage(characterId, message);
      return;
    }
    await _dispatchUserMessage(characterId, message);
  }

  Future<void> sendAttachments(
    String characterId,
    List<ChatAttachment> attachments, {
    String? caption,
    String? replyToId,
    String? replyPreview,
  }) async {
    if (attachments.isEmpty || state.sendingIn.contains(characterId)) return;
    if (attachments.length == 1) {
      await sendAttachment(
        characterId,
        attachments.first,
        caption: caption,
        replyToId: replyToId,
        replyPreview: replyPreview,
      );
      return;
    }
    final threadGeneration = _threadGenerations[characterId] ?? 0;
    final bounded = List<ChatAttachment>.unmodifiable(attachments.take(8));
    final message = AiChatMessage(
      id: _newId(),
      isUser: true,
      text: (caption ?? '').trim(),
      createdAt: DateTime.now(),
      attachments: bounded,
      replyToId: replyToId,
      replyPreview: replyPreview,
      deliveryStatus: 'sending',
      uploadProgress: 0,
      requestId: createRequestId(),
    );
    final offline = await _offlineNow();
    if (_disposed ||
        threadGeneration != (_threadGenerations[characterId] ?? 0)) {
      return;
    }
    if (offline) {
      await _enqueueMessage(characterId, message);
      return;
    }
    await _dispatchUserMessage(characterId, message);
  }

  Future<void> _dispatchUserMessage(
    String characterId,
    AiChatMessage userMsg, {
    bool retry = false,
    String? transportPrompt,
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
    // A queued voice note is not yet accepted by the network.
    _setDelivery(characterId, userMsg.id,
        userMsg.allAttachments.isNotEmpty ? 'uploading' : 'sending');
    if (_disposed || threadGeneration != (_threadGenerations[characterId] ?? 0))
      return;
    try {
      final attachment = userMsg.attachment;
      final attachmentSet = userMsg.attachments;
      final hasMedia = attachment != null || attachmentSet.isNotEmpty;
      final streamMessageId =
          !hasMedia ? _beginAiStream(characterId) : null;
      final visiblePrompt = userMsg.replyPreview?.trim().isNotEmpty == true
          ? 'Replying to this earlier message:\n"${userMsg.replyPreview}"\n\n${userMsg.text}'
          : userMsg.text;
      final promptText =
          transportPrompt?.trim().isNotEmpty == true
              ? transportPrompt!.trim()
              : visiblePrompt;
      final mediaCaption = promptText;
      var livePcmStarted = false;
      DateTime? livePcmStartedAt;
      final result = !hasMedia
          ? await _sendViaTransport(
              characterId,
              promptText,
              onTextDelta: (delta) {
                if (streamMessageId != null) {
                  _appendAiDelta(characterId, streamMessageId, delta);
                }
              },
              requestId: userMsg.requestId,
              onAudioPcmChunk: (chunk) async {
                if (!livePcmStarted) {
                  livePcmStarted = await LivePcmAudio.start(sampleRate: 24000);
                  if (livePcmStarted) {
                    livePcmStartedAt = DateTime.now();
                  }
                }
                if (livePcmStarted) {
                  await LivePcmAudio.write(chunk);
                }
              },
            )
          : attachmentSet.isNotEmpty
          ? await _sendMediaSetViaTransport(
              characterId,
              userMsg.id,
              attachmentSet,
              caption: mediaCaption,
              requestId: userMsg.requestId,
            )
          : await _sendMediaViaTransport(
              characterId,
              userMsg.id,
              attachment!,
              caption: mediaCaption,
              requestId: userMsg.requestId,
            );
      if (livePcmStarted) {
        final elapsedMs = livePcmStartedAt == null
            ? 0
            : DateTime.now().difference(livePcmStartedAt!).inMilliseconds;
        final expectedMs = result.audioDurationMs ?? elapsedMs;
        final drainMs = (expectedMs - elapsedMs + 220).clamp(220, 30000).toInt();
        unawaited(
          Future<void>.delayed(
            Duration(milliseconds: drainMs),
            LivePcmAudio.stop,
          ),
        );
      }
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
          uploadProgress: message.allAttachments.isNotEmpty ? 1.0 : null,
        ),
      );
      final requiresVoiceReply =
          userMsg.allAttachments.any((item) => item.kind == 'voice');
      if (requiresVoiceReply &&
          (result.audioBytes == null || result.audioBytes!.isEmpty)) {
        throw const ApiException(
          'The agent could not return playable audio. Retry the voice note.',
          code: 'VOICE_REPLY_MISSING',
        );
      }
      ChatAttachment? replyAudio;
      if (result.audioBytes case final audio? when audio.isNotEmpty) {
        // Voice-note and text replies can carry Gemini raw PCM, not a WAV
        // container. A failed optional player attachment must never hide an
        // already successful, persisted text reply.
        try {
          final playable = prepareAgentAudioAttachment(
            audio,
            mimeType: result.audioMimeType,
          );
          final dir = await getTemporaryDirectory();
          final path =
              '${dir.path}/masanawa_reply_${DateTime.now().microsecondsSinceEpoch}.${playable.extension}';
          await File(path).writeAsBytes(playable.bytes, flush: true);
          replyAudio = ChatAttachment(
            kind: 'voice',
            path: path,
            durationMs: result.audioDurationMs,
            sizeBytes: playable.bytes.length,
            waveform: playable.isWav
                ? _pcmWaveform(playable.bytes)
                : const [],
          );
        } catch (_) {
          if (requiresVoiceReply) {
            throw const ApiException(
              'The voice reply could not be played. Retry the voice note.',
              code: 'VOICE_REPLY_UNPLAYABLE',
            );
          }
        }
      }
      if (requiresVoiceReply && replyAudio == null) {
        throw const ApiException(
          'The voice reply is missing. Retry the voice note.',
          code: 'VOICE_REPLY_UNPLAYABLE',
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
          requestId: userMsg.requestId,
        );
      } else {
        await _appendAi(
          characterId,
          result.text,
          parts: result.parts,
          attachment: replyAudio,
          agentRunId: result.agentRunId,
          requestId: userMsg.requestId,
        );
      }
    } catch (error) {
      unawaited(LivePcmAudio.stop());
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
        requestId: userMsg.requestId,
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
    String messageId,
    ChatAttachment attachment, {
    required String caption,
    String? requestId,
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
    final hadCachedBinding = _bindings.containsKey(characterId);
    var binding = await _bindingFor(characterId, transport);
    Future<AgentTurnResult> send() => transport.sendMediaTurn(
      binding: binding,
      bytes: bytes,
      mimeType: mimeType,
      caption: caption,
      requestId: requestId,
      onUploadProgress: (sent, total) {
        if (total <= 0) return;
        _updateMessage(
          characterId,
          messageId,
          (message) => message.copyWith(
            deliveryStatus: sent >= total ? 'sent' : 'uploading',
            uploadProgress: (sent / total).clamp(0.0, 1.0).toDouble(),
          ),
          persist: false,
        );
      },
    );
    try {
      return await send();
    } catch (error) {
      if (!hadCachedBinding || !_isStaleSessionError(error)) rethrow;
      _bindings.remove(characterId);
      binding = await _bindingFor(characterId, transport);
      return send();
    }
  }

  Future<AgentTurnResult> _sendMediaSetViaTransport(
    String characterId,
    String messageId,
    List<ChatAttachment> attachments, {
    required String caption,
    String? requestId,
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
      requestId: requestId,
      onUploadProgress: (sent, total) {
        if (total <= 0) return;
        _updateMessage(
          characterId,
          messageId,
          (message) => message.copyWith(
            deliveryStatus: sent >= total ? 'sent' : 'uploading',
            uploadProgress: (sent / total).clamp(0.0, 1.0).toDouble(),
          ),
          persist: false,
        );
      },
    );
  }

  bool _isStaleSessionError(Object error) =>
      error is ApiException &&
      (error.statusCode == 404 ||
          error.statusCode == 409 ||
          error.code == 'agents.session_not_found' ||
          error.code == 'agents.session_closed');

  Future<AgentTurnResult> _sendViaTransport(
    String characterId,
    String prompt, {
    void Function(String delta)? onTextDelta,
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  }) async {
    final transport = ref.read(agentTransportProvider);
    final hadCachedBinding = _bindings.containsKey(characterId);
    var binding = await _bindingFor(characterId, transport);
    try {
      return await transport.sendTurn(
        binding: binding,
        text: prompt,
        onTextDelta: onTextDelta,
        onAudioPcmChunk: onAudioPcmChunk,
        requestId: requestId,
      );
    } catch (error) {
      if (!hadCachedBinding || !_isStaleSessionError(error)) rethrow;
      _bindings.remove(characterId);
      binding = await _bindingFor(characterId, transport);
      return transport.sendTurn(
        binding: binding,
        text: prompt,
        onTextDelta: onTextDelta,
        onAudioPcmChunk: onAudioPcmChunk,
        requestId: requestId,
      );
    }
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
    // The recipient opened the thread: anything we sent has now arrived.
    _markUserMessages(characterId, {'sending', 'sent'}, 'delivered');
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
    String? requestId,
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
        requestId: requestId,
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
    // A finished reply proves the recipient read our messages.
    _markUserMessages(characterId, {'delivered'}, 'read');
    await _save();
  }

  void _removeStreamingPlaceholders(String characterId) {
    final thread = threadOf(characterId);
    final removed = thread.messages
        .where((message) =>
            !message.isUser && message.deliveryStatus == 'streaming')
        .length;
    if (removed == 0) return;
    final messages = thread.messages
        .where((message) =>
            message.isUser || message.deliveryStatus != 'streaming')
        .toList();
    final isOpen = state.openThreadId == characterId;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          messages: messages,
          unread: isOpen ? 0 : (thread.unread - removed).clamp(0, 1 << 30).toInt(),
        ),
      },
    );
  }

  Future<void> _appendAi(
    String characterId,
    String text, {
    List<AgentMessagePart> parts = const [],
    ChatAttachment? attachment,
    String? agentRunId,
    String? requestId,
  }) async {
    if (_disposed) return;
    final thread = threadOf(characterId);
    // The completion event can restore a reply before the HTTP response has
    // finished rendering its audio. Both deliveries belong to one user turn.
    final existingIndex = requestId == null ? -1 : thread.messages.indexWhere(
      (message) => !message.isUser && message.requestId == requestId,
    );
    if (existingIndex >= 0) {
      final messages = [...thread.messages];
      final existing = messages[existingIndex];
      messages[existingIndex] = existing.copyWith(
        text: text,
        parts: parts.isEmpty ? existing.parts : parts,
        attachment: attachment ?? existing.attachment,
        deliveryStatus: 'delivered',
      );
      state = state.copyWith(
        threads: {...state.threads, characterId: thread.copyWith(
          messages: messages,
          agentRunId: agentRunId ?? thread.agentRunId,
        )},
        sendingIn: {...state.sendingIn}..remove(characterId),
      );
      _markUserMessages(characterId, {'delivered'}, 'read');
      await _save();
      return;
    }
    final isOpen = state.openThreadId == characterId;
    final msg = AiChatMessage(
      id: _newId(),
      isUser: false,
      text: text,
      parts: parts,
      attachment: attachment,
      createdAt: DateTime.now(),
      deliveryStatus: 'delivered',
      requestId: requestId,
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
    // A delivered reply proves the recipient read our messages.
    _markUserMessages(characterId, {'delivered'}, 'read');
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

  void setScrollOffset(String characterId, double offset) {
    final thread = threadOf(characterId);
    final safe = offset.isFinite && offset > 0 ? offset : 0.0;
    if ((thread.scrollOffset - safe).abs() < 12) return;
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(scrollOffset: safe),
      },
    );
    _save();
  }

  void setDraftAttachments(
    String characterId,
    List<ChatAttachment> attachments,
  ) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          draftAttachments: List.unmodifiable(attachments),
        ),
      },
    );
    _save();
  }

  void setDraftVoice(String characterId, ChatAttachment? attachment) {
    final thread = threadOf(characterId);
    state = state.copyWith(
      threads: {
        ...state.threads,
        characterId: thread.copyWith(
          draftVoice: attachment,
          clearDraftVoice: attachment == null,
        ),
      },
    );
    _save();
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
    unawaited(LivePcmAudio.stop());
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
      if (message.isUser &&
          (message.deliveryStatus == 'sending' ||
           message.deliveryStatus == 'uploading')) {
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

  /// Advances the user's own messages through receipt stages, mirroring a
  /// server-acknowledged → delivered → read pipeline. Only messages still in
  /// one of [from] move; failed, queued and stopped messages are untouched.
  void _markUserMessages(String characterId, Set<String> from, String to) {
    final thread = threadOf(characterId);
    for (final m in thread.messages) {
      if (m.isUser && !m.deleted && from.contains(m.deliveryStatus)) {
        _setDelivery(characterId, m.id, to);
      }
    }
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
    final binding = _bindings.remove(characterId);
    if (binding != null) {
      unawaited(ref.read(agentTransportProvider).closeSession(binding));
    }
    unawaited(LivePcmAudio.stop());
    final threads = {...state.threads}..remove(characterId);
    state = state.copyWith(
      threads: threads,
      sendingIn: {...state.sendingIn}..remove(characterId),
    );
    _save();
  }

  Future<void> clearAll() async {
    final ids = <String>{...state.threads.keys, ..._bindings.keys};
    for (final id in ids) {
      _threadGenerations[id] = (_threadGenerations[id] ?? 0) + 1;
    }
    final transport = ref.read(agentTransportProvider);
    final bindings = [..._bindings.values];
    _bindings.clear();
    final subscriptions = [..._eventSubscriptions.values];
    _eventSubscriptions.clear();
    _eventCursors.clear();
    state = state.copyWith(threads: {}, sendingIn: {}, shellConfigs: {});
    await _save();
    await Future.wait([
      for (final binding in bindings)
        transport.closeSession(binding).catchError((_) {}),
      for (final subscription in subscriptions)
        subscription.cancel().catchError((_) {}),
      LivePcmAudio.stop().catchError((_) {}),
      _clearOwnedTempMedia(),
    ]);
  }

  Future<void> _clearOwnedTempMedia() async {
    try {
      final dir = await getTemporaryDirectory();
      if (!await dir.exists()) return;
      await for (final entity in dir.list(followLinks: false)) {
        if (entity is! File) continue;
        final name = entity.uri.pathSegments.isEmpty
            ? ''
            : entity.uri.pathSegments.last;
        if (!name.startsWith('masanawa_voice_') &&
            !name.startsWith('masanawa_reply_')) {
          continue;
        }
        try {
          await entity.delete();
        } catch (_) {
          // One locked temp file must not block account cleanup.
        }
      }
    } catch (_) {
      // OS temp storage remains non-canonical; cleanup is best effort.
    }
  }

  List<double> _pcmWaveform(Uint8List wavBytes, {int bars = 36}) {
    if (wavBytes.length <= 44 || bars < 1) return const [];
    final pcm = wavBytes.sublist(44);
    final sampleCount = pcm.length ~/ 2;
    if (sampleCount < bars) return const [];
    final samplesPerBar =
        (sampleCount / bars).floor().clamp(1, sampleCount).toInt();
    final values = <double>[];
    for (var bar = 0; bar < bars; bar++) {
      final startSample = bar * samplesPerBar;
      if (startSample >= sampleCount) break;
      final endSample =
          ((bar + 1) * samplesPerBar).clamp(0, sampleCount).toInt();
      var peak = 0;
      for (var sample = startSample; sample < endSample; sample++) {
        final offset = sample * 2;
        if (offset + 1 >= pcm.length) break;
        var value = pcm[offset] | (pcm[offset + 1] << 8);
        if (value >= 0x8000) value -= 0x10000;
        final magnitude = value.abs();
        if (magnitude > peak) peak = magnitude;
      }
      values.add((peak / 32768).clamp(0.06, 1.0).toDouble());
    }
    return List.unmodifiable(values);
  }

  String _newId() => 'm-${DateTime.now().microsecondsSinceEpoch}-${_seq++}';

  Future<Directory?> _documentsDirectory() {
    return _documentsDirectoryFuture ??= (() async {
      try {
        return await getApplicationDocumentsDirectory();
      } catch (_) {
        return null;
      }
    })();
  }

  Future<File?> _threadsFile(String ownerId) async {
    if (ownerId.isEmpty) return null;
    final dir = await _documentsDirectory();
    if (dir == null) return null;
    final owner =
        base64Url.encode(utf8.encode(ownerId)).replaceAll('=', '');
    return File('${dir.path}/masanawa_threads_v2_$owner.json');
  }

  Future<void> _deleteLegacyThreadCache() async {
    try {
      final dir = await _documentsDirectory();
      if (dir == null) return;
      final legacy = File('${dir.path}/$_kThreadsFile');
      if (await legacy.exists()) await legacy.delete();
    } catch (_) {
      // Legacy cache is never loaded; failed deletion does not block startup.
    }
  }

  Future<void> _deleteThreadCache(String ownerId) async {
    try {
      final file = await _threadsFile(ownerId);
      if (file != null && await file.exists()) await file.delete();
    } catch (_) {
      // Account cleanup remains best effort locally; server history is canonical.
    }
  }

  Future<void> _handleOwnerChange(
    String? previousOwner,
    String? nextOwner,
    int generation,
  ) async {
    _connectionGeneration++;
    final ids = <String>{...state.threads.keys, ..._bindings.keys};
    for (final id in ids) {
      _threadGenerations[id] = (_threadGenerations[id] ?? 0) + 1;
    }
    final transport = ref.read(agentTransportProvider);
    final bindings = [..._bindings.values];
    _bindings.clear();
    final subscriptions = [..._eventSubscriptions.values];
    _eventSubscriptions.clear();
    _eventCursors.clear();
    state = state.copyWith(
      threads: {},
      sendingIn: {},
      shellConfigs: {},
      clearOpen: true,
    );

    if (previousOwner != null && previousOwner.isNotEmpty) {
      await clearSecureShellState(ownerId: previousOwner);
      await _deleteThreadCache(previousOwner);
    }
    await Future.wait([
      for (final binding in bindings)
        transport.closeSession(binding).catchError((_) {}),
      for (final subscription in subscriptions)
        subscription.cancel().catchError((_) {}),
      LivePcmAudio.stop().catchError((_) {}),
      _clearOwnedTempMedia(),
    ]);

    if (_disposed ||
        generation != _cacheGeneration ||
        nextOwner == null ||
        nextOwner.isEmpty ||
        nextOwner != _cacheOwnerId) {
      return;
    }
    await _load(nextOwner, generation);
  }

  Future<void> _load(String ownerId, int generation) async {
    try {
      final file = await _threadsFile(ownerId);
      if (file == null) return;

      // The retired unscoped cache is never read. Keep its cleanup off the
      // current account's hydration path so cached chats can paint first.
      unawaited(_deleteLegacyThreadCache());

      if (!await file.exists()) return;
      final raw = jsonDecode(await file.readAsString());
      final list = (raw as List? ?? [])
          .map((e) => ChatThread.fromJson((e as Map).cast<String, dynamic>()))
          .where((t) => t.characterId.isNotEmpty)
          .toList();
      if (_disposed ||
          generation != _cacheGeneration ||
          ownerId != _cacheOwnerId ||
          list.isEmpty) {
        return;
      }
      state = state.copyWith(
        threads: {for (final t in list) t.characterId: t, ...state.threads},
      );
      MasanawaStartupMetrics.mark('cached_threads_ready');
    } catch (_) {
      // Corrupt/missing cache never prevents the user from opening chat.
    }
  }

  Future<void> _save() async {
    final ownerId = _cacheOwnerId;
    if (ownerId == null || ownerId.isEmpty) return;
    try {
      final file = await _threadsFile(ownerId);
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
