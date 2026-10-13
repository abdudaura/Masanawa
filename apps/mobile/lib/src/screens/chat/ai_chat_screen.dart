import 'dart:async';
import 'dart:io';

import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:mime/mime.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:audio_session/audio_session.dart';

import '../../agents/agent_directory.dart';
import '../../chat/chat_format.dart';
import '../../chat/cafe_suggestions.dart';
import '../../chat/message_parts.dart';
import '../../chat/message_parts_view.dart';
import '../../chat/shell_document.dart';
import '../../calls/call_lifecycle_reporter.dart';
import '../../calls/call_lifecycle_limits.dart';
import '../../calls/group_paid_voice_transport.dart';
import '../../calls/group_paid_voice_outbox.dart';
import '../../core/live_pcm_audio.dart';
import '../../core/live_voice_session.dart';
import '../../ui/components/voice_note_composer.dart';
import '../../core/app_permissions.dart';
import '../../agents/agent_shell.dart';
import '../../agents/masanawa_transport.dart';
import '../../core/providers.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../state/wallet_state.dart';
import '../../voice/paid_voice.dart';
import '../../voice/paid_voice_state.dart';
import '../../safety/twin_safety.dart';
import '../../safety/twin_safety_state.dart';
import '../../theme/masanawa_theme.dart';

/// One Character conversation. Voice is the primary action while text,
/// attachments and structured work results remain in the same timeline.
enum AiChatEntryMode { chat, teach, study, liveTalk, liveVoice, cafe }

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({
    super.key,
    required this.characterId,
    this.entryMode = AiChatEntryMode.chat,
    this.initialPrompt,
    this.embeddedInShell = false,
    this.onOpenAgents,
    this.onOpenActivity,
    this.onOpenProfile,
  });

  final String characterId;
  final AiChatEntryMode entryMode;
  final String? initialPrompt;
  /// Root Talk tab: own app bar remains, but leading and overflow navigate
  /// within the shell rather than assuming a separate pushed chat route.
  final bool embeddedInShell;
  final VoidCallback? onOpenAgents;
  final VoidCallback? onOpenActivity;
  final VoidCallback? onOpenProfile;

  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _imagePicker = ImagePicker();
  bool _showEmoji = false;
  bool _hasText = false;
  List<ChatAttachment> _pendingAttachments = const [];
  AiChatMessage? _replyingTo;
  bool _showSearch = false;
  final _search = TextEditingController();
  int _searchIndex = 0;
  bool _nearBottom = true;
  int _newBelow = 0;
  Timer? _scrollPersistTimer;
  Timer? _walletRefreshTimer;
  final Set<String> _selectedMessageIds = {};
  final Map<String, GlobalKey> _messageKeys = {};
  bool _initialEntryHandled = false;
  String? _cafeCategory;
  LiveVoiceSession? _inlineVoiceSession;
  LiveVoiceSession? _modalVoiceSession;
  ProviderSubscription<SessionState>? _voiceAccountSubscription;
  StreamSubscription<String>? _inlineTranscriptSub;
  StreamSubscription<LiveVoiceState>? _inlineVoiceStateSub;
  StreamSubscription<void>? _inlineTurnSub;
  PaidVoiceAdmission? _inlinePaidAdmission;
  PaidVoiceController? _inlinePaidController;
  AgentShellTransport? _inlineShellTransport;
  String? _inlineVoiceCharacterId;
  String _inlineTranscript = '';
  String _inlineTranscriptHistory = '';
  String _inlineCurrentTranscript = '';
  LiveVoiceState _inlineVoiceState = LiveVoiceState.idle;
  bool _inlineVoiceClosing = false;
  bool _voiceNoteSheetOpen = false;

  @override
  void initState() {
    super.initState();
    _voiceAccountSubscription = ref.listenManual(sessionProvider, (
      previous,
      next,
    ) {
      final previousId = previous is SessionSignedIn ? previous.user.id : null;
      final nextId = next is SessionSignedIn ? next.user.id : null;
      if (previousId != nextId) {
        unawaited(_inlineVoiceSession?.close() ?? Future<void>.value());
        unawaited(_modalVoiceSession?.close() ?? Future<void>.value());
      }
    });
    _input.addListener(() {
      final hasText = _input.text.isNotEmpty;
      if (hasText != _hasText) setState(() => _hasText = hasText);
      ref.read(aiChatProvider.notifier).setDraft(widget.characterId, _input.text);
    });
    _scroll.addListener(() {
      if (!_scroll.hasClients) return;
      final distance = _scroll.position.maxScrollExtent - _scroll.offset;
      final near = distance < 120;
      if (near != _nearBottom && mounted) {
        setState(() {
          _nearBottom = near;
          if (near) _newBelow = 0;
        });
      }
      _scrollPersistTimer?.cancel();
      _scrollPersistTimer = Timer(const Duration(milliseconds: 280), () {
        if (!mounted || !_scroll.hasClients) return;
        ref
            .read(aiChatProvider.notifier)
            .setScrollOffset(widget.characterId, _scroll.offset);
      });
    });
    _walletRefreshTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted) return;
      unawaited(ref.read(walletProvider.notifier).refresh());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(ref.read(walletProvider.notifier).refresh());
      final controller = ref.read(aiChatProvider.notifier);
      controller.openThread(widget.characterId);
      final thread = controller.threadOf(widget.characterId);
      final draft = thread.draft;
      if (draft.isNotEmpty && _input.text.isEmpty) {
        _input.text = draft;
        _input.selection = TextSelection.collapsed(offset: draft.length);
      }
      if (mounted) {
        setState(() {
          _pendingAttachments = [
            for (final item in thread.draftAttachments)
              if (File(item.path).existsSync()) item,
          ];
        });
      }
      final offset = thread.scrollOffset;
      if (offset > 0) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!_scroll.hasClients) return;
          _scroll.jumpTo(
            offset.clamp(
              _scroll.position.minScrollExtent,
              _scroll.position.maxScrollExtent,
            ).toDouble(),
          );
        });
      }
    });
  }

  @override
  void dispose() {
    _voiceAccountSubscription?.close();
    unawaited(_modalVoiceSession?.close() ?? Future<void>.value());
    _scrollPersistTimer?.cancel();
    _walletRefreshTimer?.cancel();
    _inlineTranscriptSub?.cancel();
    _inlineVoiceStateSub?.cancel();
    _inlineTurnSub?.cancel();
    unawaited(_disposeInlineVoice());
    _input.dispose();
    _search.dispose();
    _scroll.dispose();
    try {
      ref.read(aiChatProvider.notifier).closeThread();
    } catch (_) {}
    super.dispose();
  }

  void _scrollToBottom() {
    if (!_scroll.hasClients) return;
    _scroll.animateTo(
      _scroll.position.maxScrollExtent,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  void _sendText() {
    if (ref.read(aiChatProvider).sendingIn.contains(widget.characterId)) return;
    final text = _input.text;
    final attachments = _pendingAttachments;
    if (text.trim().isEmpty && attachments.isEmpty) return;
    final reply = _replyingTo;
    if (widget.entryMode == AiChatEntryMode.study &&
        attachments.isEmpty &&
        text.trim().isNotEmpty) {
      final visible = text.trim();
      _input.clear();
      ref.read(aiChatProvider.notifier).setDraft(widget.characterId, '');
      setState(() {
        _showEmoji = false;
        _replyingTo = null;
      });
      unawaited(
        ref.read(aiChatProvider.notifier).sendText(
              widget.characterId,
              visible,
              replyToId: reply?.id,
              replyPreview: reply?.text,
              transportPrompt: '<masanawa_study>$visible',
            ),
      );
      return;
    }

    _commitTextSend(text, attachments, reply);
  }

  void _sendCafeSuggestion(CafeSuggestion suggestion) {
    if (ref.read(aiChatProvider).sendingIn.contains(widget.characterId)) return;
    setState(() => _cafeCategory = suggestion.key);
    unawaited(
      ref.read(aiChatProvider.notifier).sendText(
            widget.characterId,
            suggestion.message,
          ),
    );
  }

  void _commitTextSend(
    String text,
    List<ChatAttachment> attachments,
    AiChatMessage? reply,
  ) {
    _input.clear();
    final ctl = ref.read(aiChatProvider.notifier);
    ctl.setDraft(widget.characterId, '');
    ctl.setDraftAttachments(widget.characterId, const []);
    setState(() {
      _showEmoji = false;
      _replyingTo = null;
      _pendingAttachments = const [];
    });
    if (attachments.isNotEmpty) {
      unawaited(
        ctl.sendAttachments(
          widget.characterId,
          attachments,
          caption: text,
          replyToId: reply?.id,
          replyPreview: reply == null
              ? null
              : (reply.text.isNotEmpty
                  ? reply.text
                  : reply.allAttachments.isNotEmpty
                      ? reply.allAttachments.first.label
                      : 'Message'),
        ),
      );
      return;
    }
    unawaited(
      ctl.sendText(
        widget.characterId,
        text,
        replyToId: reply?.id,
        replyPreview: reply == null
            ? null
            : (reply.text.isNotEmpty
                ? reply.text
                : reply.allAttachments.isNotEmpty
                    ? reply.allAttachments.first.label
                    : 'Message'),
      ),
    );
  }
  void _stageAttachments(List<ChatAttachment> attachments) {
    if (attachments.isEmpty) return;
    final merged = [
      ..._pendingAttachments,
      ...attachments,
    ].take(8).toList(growable: false);
    setState(() {
      _pendingAttachments = merged;
      _showEmoji = false;
    });
    ref
        .read(aiChatProvider.notifier)
        .setDraftAttachments(widget.characterId, merged);
  }

  void _removePendingAttachment(int index) {
    if (index < 0 || index >= _pendingAttachments.length) return;
    final next = [..._pendingAttachments]..removeAt(index);
    setState(() => _pendingAttachments = next);
    ref
        .read(aiChatProvider.notifier)
        .setDraftAttachments(widget.characterId, next);
  }

  void _comingSoon(String what) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('$what are coming soon.')));
  }

  Future<bool> _ensurePermission(
    AppPermission permission,
    String label,
  ) async {
    final result = await AppPermissions.request(permission);
    if (result.granted) return true;
    if (!mounted) return false;
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          result.permanentlyDenied
              ? '$label permission is disabled in system settings.'
              : '$label permission is needed for this action.',
        ),
        action: result.permanentlyDenied
            ? SnackBarAction(
                label: 'Settings',
                onPressed: AppPermissions.openSettings,
              )
            : null,
      ),
    );
    return false;
  }

  /// Record a local voice message, without starting a paid LiveKit/Gemini call.
  /// The existing chat controller retains offline queue/retry and receipts.
  Future<void> _openVoiceNoteComposer() async {
    if (_voiceNoteSheetOpen || !mounted) return;
    if (_inlineVoiceSession != null || _modalVoiceSession != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End the live call before recording a voice note.')),
      );
      return;
    }
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn || session.user.id.isEmpty) return;
    final accountId = session.user.id;
    final recorder = ref.read(voiceNoteRecorderFactoryProvider)();
    _voiceNoteSheetOpen = true;
    FocusScope.of(context).unfocus();
    bool sameAccount() {
      if (!mounted) return false;
      final active = ref.read(sessionProvider);
      return active is SessionSignedIn && active.user.id == accountId;
    }
    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => VoiceNoteComposer(
          recorder: recorder,
          isOwnerCurrent: sameAccount,
          onSend: (attachment) async {
            if (!sameAccount() ||
                ref.read(aiChatProvider).sendingIn.contains(widget.characterId)) {
              return false;
            }
            await ref.read(aiChatProvider.notifier)
                .sendAttachment(widget.characterId, attachment);
            return sameAccount();
          },
        ),
      );
    } finally {
      await recorder.close();
      _voiceNoteSheetOpen = false;
    }
  }

  // ---- Attachments ---------------------------------------------------------

  void _openAttachSheet() {
    FocusScope.of(context).unfocus();
    final u = context.masanawa;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
            child: Wrap(
              spacing: 18,
              runSpacing: 12,
              alignment: WrapAlignment.center,
              children: [
                // Token roles: brand → doc, verified → gallery, warning → camera.
                _AttachOption(
                  icon: Icons.insert_drive_file,
                  color: u.success,
                  label: 'Document',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickDocument();
                  },
                ),
                _AttachOption(
                  icon: Icons.photo,
                  color: u.brand,
                  label: 'Gallery',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickMultipleImages();
                  },
                ),
                _AttachOption(
                  icon: Icons.camera_alt,
                  color: u.warning,
                  label: 'Camera',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickImage(ImageSource.camera);
                  },
                ),
                _AttachOption(
                  icon: Icons.videocam_outlined,
                  color: u.brandStrong,
                  label: 'Video',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickVideo();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickDocument() async {
    try {
      final files = await FilePicker.pickFiles();
      if (files.isEmpty) return;
      final attachments = <ChatAttachment>[];
      for (final file in files.take(6)) {
        final path = file.path;
        if (path == null || path.isEmpty) continue;
        final size = await file.length() ?? 0;
        attachments.add(
          ChatAttachment(
            kind: 'doc',
            path: path,
            name: file.name,
            sizeBytes: size,
          ),
        );
      }
      if (attachments.isNotEmpty && mounted) {
        _stageAttachments(attachments);
      }
    } catch (_) {
      if (mounted) _comingSoon('Documents');
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    if (source == ImageSource.camera &&
        !await _ensurePermission(AppPermission.camera, 'Camera')) {
      return;
    }
    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;
      final size = await File(picked.path).length();
      if (!mounted) return;
      _stageAttachments([
        ChatAttachment(
          kind: 'image',
          path: picked.path,
          name: picked.name,
          sizeBytes: size,
        ),
      ]);
    } catch (_) {
      if (mounted) _comingSoon('Photos');
    }
  }

  Future<void> _pickMultipleImages() async {
    try {
      final picked = await _imagePicker.pickMultiImage(
        maxWidth: 1600,
        imageQuality: 85,
      );
      final attachments = <ChatAttachment>[];
      for (final image in picked.take(8)) {
        final size = await File(image.path).length();
        attachments.add(
          ChatAttachment(
            kind: 'image',
            path: image.path,
            name: image.name,
            sizeBytes: size,
          ),
        );
      }
      if (attachments.isNotEmpty) {
        await ref
            .read(aiChatProvider.notifier)
            .sendAttachments(widget.characterId, attachments);
      }
    } catch (_) {
      if (mounted) _comingSoon('Photos');
    }
  }

  Future<void> _pickVideo() async {
    try {
      final picked = await _imagePicker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(minutes: 3),
      );
      if (picked == null) return;
      final size = await File(picked.path).length();
      if (size > 8 * 1024 * 1024) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Video must be 8 MB or smaller.')),
          );
        }
        return;
      }
      if (!mounted) return;
      _stageAttachments([
        ChatAttachment(
          kind: 'video',
          path: picked.path,
          name: picked.name,
          sizeBytes: size,
        ),
      ]);
    } catch (_) {
      if (mounted) _comingSoon('Video');
    }
  }

  // ---- Build ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final directory = ref.watch(agentDirectoryProvider);
    final agent = directory.find(widget.characterId);
    final chat = ref.watch(aiChatProvider);
    final thread = chat.threads[widget.characterId];
    final shellConfig = chat.shellConfigs[widget.characterId];
    final updateRequired = shellConfig?.requiresUpdate() ?? false;
    final liveVoiceEnabled =
        shellConfig?.feature('liveVoice', fallback: true) ?? true;
    final allMessages = thread?.messages ?? const <AiChatMessage>[];
    final query = _search.text.trim().toLowerCase();
    final messages = allMessages;
    final searchMatches = query.isEmpty
        ? const <AiChatMessage>[]
        : allMessages
            .where((m) => !m.deleted && m.text.toLowerCase().contains(query))
            .toList();
    if (_searchIndex >= searchMatches.length && searchMatches.isNotEmpty) {
      _searchIndex = searchMatches.length - 1;
    }
    final highlightedSearchId = searchMatches.isEmpty
        ? null
        : searchMatches[_searchIndex].id;
    final sending = chat.sendingIn.contains(widget.characterId);
    final userMessages = allMessages.where((m) => m.isUser).toList();
    final lastUser = userMessages.isEmpty ? null : userMessages.last;

    if (agent == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Agent')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  directory.loading
                      ? 'Loading agent…'
                      : directory.error ??
                            'This agent isn’t available right now.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: directory.loading
                      ? null
                      : () =>
                            ref.read(agentDirectoryProvider.notifier).refresh(),
                  child: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final workingLabel = !sending
        ? agent.presenceLabel
        : lastUser?.attachment?.kind == 'voice'
        ? 'Understanding voice…'
        : lastUser?.attachment != null
        ? 'Reviewing attachment…'
        : 'Typing…';

    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(aiChatProvider.notifier)
          .seedGreeting(agent.characterId, agent.greeting);
    });
    if (!_initialEntryHandled) {
      _initialEntryHandled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final prompt = widget.initialPrompt?.trim();
        if (prompt != null && prompt.isNotEmpty) {
          unawaited(
            ref.read(aiChatProvider.notifier).sendText(
                  widget.characterId,
                  prompt,
                  transportPrompt: widget.entryMode == AiChatEntryMode.study
                      ? '<masanawa_study>$prompt'
                      : null,
                ),
          );
        }
        switch (widget.entryMode) {
          case AiChatEntryMode.chat:
          case AiChatEntryMode.teach:
            break;
          case AiChatEntryMode.study:
            break;
          case AiChatEntryMode.liveTalk:
            unawaited(_startInlineLiveVoice(agent));
            break;
          case AiChatEntryMode.liveVoice:
            unawaited(_openLiveVoice(agent));
            break;
          case AiChatEntryMode.cafe:
            break;
        }
      });
    }

    ref.listen(aiChatProvider, (prev, next) {
      final before = prev?.threads[widget.characterId]?.messages.length ?? 0;
      final after = next.threads[widget.characterId]?.messages.length ?? 0;
      if (after > before) {
        if (_nearBottom) {
          Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
        } else {
          setState(() => _newBelow += after - before);
        }
      } else if (prev?.sendingIn != next.sendingIn && _nearBottom) {
        Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
      }
    });

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) setState(() => _showEmoji = false);
      },
      child: Scaffold(
        backgroundColor: u.chatBg,
        appBar: AppBar(
          backgroundColor: u.surfaceCard,
          foregroundColor: u.textPrimary,
          elevation: 0,
          leadingWidth: 40,
          leading: widget.embeddedInShell
              ? IconButton(
                  tooltip: 'New chat',
                  icon: const Icon(Icons.smart_toy_outlined),
                  onPressed:
                      widget.onOpenAgents ?? () => context.push('/masana'),
                )
              : IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => context.canPop()
                      ? context.pop()
                      : context.go('/home?tab=chats'),
                ),
          title: _selectedMessageIds.isNotEmpty
              ? Text('${_selectedMessageIds.length} selected')
              : _showSearch
              ? TextField(
                  controller: _search,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: 'Search this chat',
                    border: InputBorder.none,
                  ),
                  onChanged: (_) {
                    setState(() => _searchIndex = 0);
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      _scrollToSearchMatch();
                    });
                  },
                )
              : InkWell(
            onTap: widget.embeddedInShell
                ? widget.onOpenAgents
                : () => context.push('/masana'),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 17,
                  backgroundColor: Colors.white,
                  child: Text(
                    agent.initial,
                    style: TextStyle(
                      color: u.brandStrong,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        agent.displayName,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        workingLabel,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .82),
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            if (_selectedMessageIds.isNotEmpty) ...[
              IconButton(
                tooltip: 'Copy selected',
                icon: const Icon(Icons.copy_outlined),
                onPressed: () => _copySelected(allMessages),
              ),
              IconButton(
                tooltip: 'Delete selected',
                icon: const Icon(Icons.delete_outline),
                onPressed: () => _deleteSelected(),
              ),
              IconButton(
                tooltip: 'Clear selection',
                icon: const Icon(Icons.close),
                onPressed: () => setState(_selectedMessageIds.clear),
              ),
            ] else
            IconButton(
              tooltip: _showSearch ? 'Close search' : 'Search',
              icon: Icon(_showSearch ? Icons.close : Icons.search),
              onPressed: () => setState(() {
                _showSearch = !_showSearch;
                if (!_showSearch) _search.clear();
              }),
            ),
            if (_showSearch && searchMatches.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Center(
                  child: Text(
                    '${_searchIndex + 1}/${searchMatches.length}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Previous result',
                icon: const Icon(Icons.keyboard_arrow_up),
                onPressed: () => _moveSearch(-1, searchMatches),
              ),
              IconButton(
                tooltip: 'Next result',
                icon: const Icon(Icons.keyboard_arrow_down),
                onPressed: () => _moveSearch(1, searchMatches),
              ),
            ],
            IconButton(
              tooltip: 'Call',
              icon: const Icon(Icons.call_outlined),
              onPressed: updateRequired || !liveVoiceEnabled
                  ? null
                  : () => _openLiveVoice(agent),
            ),
            PopupMenuButton<String>(
              tooltip: 'More',
              onSelected: (value) async {
                final ctl = ref.read(aiChatProvider.notifier);
                if (value == 'activity') widget.onOpenActivity?.call();
                if (value == 'profile') widget.onOpenProfile?.call();
                if (value == 'clear') _confirmClear(agent);
                if (value == 'new') await ctl.newContext(widget.characterId);
                if (value == 'pin') ctl.togglePin(widget.characterId);
                if (value == 'archive') ctl.toggleArchive(widget.characterId);
                if (value == 'rename') _renameConversation();
                if (value == 'gift') await _sendTwinGift(agent);
                if (value == 'block') await _blockAgent(agent);
                if (value == 'report') await _reportAgent(agent);
              },
              itemBuilder: (_) => [
                if (widget.embeddedInShell) ...const [
                  PopupMenuItem(value: 'activity', child: Text('Activity')),
                  PopupMenuItem(value: 'profile', child: Text('Profile')),
                  PopupMenuDivider(),
                ],
                const PopupMenuItem(value: 'new', child: Text('New context')),
                const PopupMenuItem(value: 'rename', child: Text('Rename chat')),
                const PopupMenuItem(value: 'pin', child: Text('Pin / unpin')),
                const PopupMenuItem(value: 'archive', child: Text('Archive / unarchive')),
                if (!agent.supportAgent) ...const [
                  PopupMenuDivider(),
                  PopupMenuItem(value: 'gift', child: Text('Send gift')),
                  PopupMenuItem(value: 'block', child: Text('Block')),
                  PopupMenuItem(value: 'report', child: Text('Report')),
                ],
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'clear', child: Text('Clear chat')),
              ],
            ),
          ],
        ),
        body: Column(
          children: [
            if (updateRequired)
              MaterialBanner(
                content: Text(
                  'This Masanawa service now requires app version '
                  '${shellConfig!.minimumAppVersion} or newer.',
                ),
                actions: const [SizedBox.shrink()],
              ),
            if (!chat.online)
              Semantics(
                liveRegion: true,
                child: Container(
                  width: double.infinity,
                  color: u.warning.withValues(alpha: .14),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  child: Text(
                    'Offline · messages will send when your connection returns',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: u.textPrimary, fontSize: 12),
                  ),
                ),
              ),
            if (widget.entryMode == AiChatEntryMode.cafe)
              _CafeSuggestionBar(
                selectedKey: _cafeCategory,
                onTap: _sendCafeSuggestion,
              ),
            Expanded(
              child: messages.isEmpty && !sending
                  ? const SizedBox.shrink()
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      itemCount: messages.length +
                          (sending &&
                                  !messages.any((m) =>
                                      !m.isUser &&
                                      m.deliveryStatus == 'streaming')
                              ? 1
                              : 0),
                      itemBuilder: (context, index) {
                        if (index >= messages.length) {
                          return const _TypingBubble();
                        }
                        final message = messages[index];
                        final failedParts = message.parts.where(
                          (p) =>
                              p.kind == AgentMessagePartKind.status &&
                              p.status == 'failed',
                        );
                        final failure = failedParts.isEmpty
                            ? null
                            : failedParts.first;
                        final previous = index > 0 ? messages[index - 1] : null;
                        final showDate = previous == null ||
                            !_sameDay(previous.createdAt, message.createdAt);
                        return Column(
                          children: [
                            if (showDate) _DateSeparator(date: message.createdAt),
                            KeyedSubtree(
                              key: _messageKeys.putIfAbsent(
                                message.id,
                                () => GlobalKey(),
                              ),
                              child: _ChatBubble(
                          message: message,
                          selected: _selectedMessageIds.contains(message.id),
                          highlighted: highlightedSearchId == message.id,
                          onSelect: () => setState(() {
                            if (!_selectedMessageIds.add(message.id)) {
                              _selectedMessageIds.remove(message.id);
                            }
                          }),
                          onReply: () => setState(() => _replyingTo = message),
                          onReact: (emoji) => ref
                              .read(aiChatProvider.notifier)
                              .reactToMessage(widget.characterId, message.id, emoji),
                          onEdit: message.isUser
                              ? () => _editMessage(message)
                              : null,
                          onDelete: () => ref
                              .read(aiChatProvider.notifier)
                              .deleteMessage(widget.characterId, message.id),
                          onCopy: () => Clipboard.setData(
                            ClipboardData(text: message.text),
                          ),
                          onForward: () => _forwardMessage(message),
                          onShare: () => _shareMessage(message),
                          onSaveMedia: message.allAttachments.isEmpty
                              ? null
                              : () => _saveMessageMedia(message),
                          onAgentAction: message.isUser
                              ? null
                              : (action) => _runAgentAction(message, action),
                          onShellAction: message.isUser
                              ? null
                              : (action) => ref
                                  .read(aiChatProvider.notifier)
                                  .submitShellAction(widget.characterId, action),
                          onRetry: failure == null || sending
                              ? null
                              : () async {
                                  if (failure.actionLabel == 'Sign in') {
                                    await ref
                                        .read(sessionProvider.notifier)
                                        .logout();
                                  } else if (failure.actionLabel ==
                                      'Reconnect') {
                                    await ref
                                        .read(agentDirectoryProvider.notifier)
                                        .refresh();
                                    if (failure.referenceId != null) {
                                      await ref
                                          .read(aiChatProvider.notifier)
                                          .retryMessage(
                                            widget.characterId,
                                            failure.referenceId!,
                                          );
                                    }
                                  } else if (failure.referenceId != null) {
                                    await ref
                                        .read(aiChatProvider.notifier)
                                        .retryMessage(
                                          widget.characterId,
                                          failure.referenceId!,
                                        );
                                  }
                                },
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),
            if (!_nearBottom && _newBelow > 0)
              Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: 12, bottom: 4),
                  child: FloatingActionButton.small(
                    heroTag: 'chat-bottom',
                    onPressed: () {
                      setState(() => _newBelow = 0);
                      _scrollToBottom();
                    },
                    child: Text(_newBelow > 9 ? '9+' : '$_newBelow'),
                  ),
                ),
              ),
            if (_inlineVoiceSession != null)
              _InlineVoicePanel(
                agentName: agent.displayName,
                transcript: _inlineTranscript,
                state: _inlineVoiceState,
                onStop: () => unawaited(
                  _stopInlineLiveVoice(outcome: 'completed'),
                ),
              ),
            if (widget.entryMode == AiChatEntryMode.study)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(12, 6, 12, 2),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: u.brand.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: u.brand.withValues(alpha: .18)),
                ),
                child: Text(
                  'Study · ask, answer, or speak naturally. Your learning progress is saved privately.',
                  style: TextStyle(color: u.textMuted, fontSize: 12, height: 1.35),
                ),
              ),
            if (_pendingAttachments.isNotEmpty)
              _PendingAttachmentStrip(
                attachments: _pendingAttachments,
                onRemove: _removePendingAttachment,
              ),
            if (_replyingTo != null)
              _ReplyComposerPreview(
                message: _replyingTo!,
                onClose: () => setState(() => _replyingTo = null),
              ),
            _Composer(
                controller: _input,
                hasText: _hasText || _pendingAttachments.isNotEmpty,
                sending: sending || updateRequired,
                onSend: updateRequired ? () {} : _sendText,
                onStop: () async {
                  await _activeVoiceBubble?._pauseFromAnotherBubble();
                  ref.read(aiChatProvider.notifier).stopGeneration(widget.characterId);
                },
                onAttach: _openAttachSheet,
                onMic: updateRequired
                    ? () {}
                    : () => unawaited(_openVoiceNoteComposer()),
                onEmojiToggle: () {
                  if (_showEmoji) {
                    setState(() => _showEmoji = false);
                    FocusScope.of(context).requestFocus(FocusNode());
                  } else {
                    FocusScope.of(context).unfocus();
                    setState(() => _showEmoji = true);
                  }
                },
              ),
            if (_showEmoji)
              SizedBox(
                height: 270,
                child: EmojiPicker(textEditingController: _input),
              ),
          ],
        ),
      ),
    );
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  void _moveSearch(int delta, List<AiChatMessage> matches) {
    if (matches.isEmpty) return;
    setState(() {
      _searchIndex = (_searchIndex + delta) % matches.length;
      if (_searchIndex < 0) _searchIndex += matches.length;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToSearchMatch());
  }

  void _scrollToSearchMatch() {
    final query = _search.text.trim().toLowerCase();
    if (query.isEmpty) return;
    final messages = ref
        .read(aiChatProvider.notifier)
        .threadOf(widget.characterId)
        .messages
        .where((m) => !m.deleted && m.text.toLowerCase().contains(query))
        .toList();
    if (messages.isEmpty) return;
    final index = _searchIndex.clamp(0, messages.length - 1).toInt();
    final key = _messageKeys[messages[index].id];
    final target = key?.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(
        target,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        alignment: 0.35,
      );
    }
  }

  void _copySelected(List<AiChatMessage> messages) {
    final text = messages
        .where((m) => _selectedMessageIds.contains(m.id) && !m.deleted)
        .map((m) {
          if (m.text.isNotEmpty) return m.text;
          if (m.allAttachments.isNotEmpty) {
            return m.allAttachments.map((item) => item.label).join(' · ');
          }
          return '';
        })
        .where((value) => value.isNotEmpty)
        .join('\n\n');
    if (text.isNotEmpty) Clipboard.setData(ClipboardData(text: text));
    setState(_selectedMessageIds.clear);
  }

  void _deleteSelected() {
    final ctl = ref.read(aiChatProvider.notifier);
    for (final id in _selectedMessageIds) {
      ctl.deleteMessage(widget.characterId, id);
    }
    setState(_selectedMessageIds.clear);
  }

  Future<void> _shareMessage(AiChatMessage message) async {
    final attachments = message.allAttachments
        .where((item) => File(item.path).existsSync())
        .toList();
    if (message.text.isEmpty && attachments.isEmpty) return;
    await SharePlus.instance.share(
      ShareParams(
        text: message.text.isEmpty ? null : message.text,
        files: [
          for (final attachment in attachments)
            XFile(
              attachment.path,
              name: attachment.name,
              mimeType: lookupMimeType(attachment.path),
            ),
        ],
      ),
    );
  }

  Future<void> _saveMessageMedia(AiChatMessage message) async {
    final items = message.allAttachments
        .where((item) => File(item.path).existsSync())
        .toList();
    if (items.isEmpty) return;

    var saved = 0;
    for (final item in items) {
      try {
        final fallbackName = item.kind == 'image'
            ? 'masanawa-photo.jpg'
            : item.kind == 'voice'
            ? 'masanawa-voice.m4a'
            : item.kind == 'video'
            ? 'masanawa-video.mp4'
            : 'masanawa-file';
        final bytes = await File(item.path).readAsBytes();
        final output = await FilePicker.saveFile(
          dialogTitle: 'Save from Masanawa',
          fileName: item.name ?? fallbackName,
          bytes: bytes,
          mimeType:
              lookupMimeType(item.path) ?? 'application/octet-stream',
        );
        if (output == null) break;
        saved++;
      } catch (_) {}
    }
    if (mounted && saved > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            saved == 1 ? 'Saved 1 file' : 'Saved $saved files',
          ),
        ),
      );
    }
  }

  Future<void> _forwardMessage(AiChatMessage message) async {
    final agents = ref.read(agentDirectoryProvider).agents;
    final target = await showModalBottomSheet<AgentDirectoryEntry>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(
              title: Text('Forward to agent'),
              subtitle: Text('Choose a conversation'),
            ),
            for (final entry in agents)
              ListTile(
                leading: CircleAvatar(child: Text(entry.initial)),
                title: Text(entry.displayName),
                subtitle: Text(entry.roleLabel),
                onTap: () => Navigator.pop(sheetContext, entry),
              ),
          ],
        ),
      ),
    );
    if (target == null) return;
    final ctl = ref.read(aiChatProvider.notifier);
    if (message.allAttachments.isNotEmpty) {
      await ctl.sendAttachments(
        target.characterId,
        message.allAttachments,
        caption: message.text,
      );
    } else if (message.text.isNotEmpty) {
      await ctl.sendText(target.characterId, message.text);
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Forwarded to ${target.displayName}')),
      );
    }
  }

  Future<void> _sendTwinGift(AgentDirectoryEntry agent) async {
    final amountController = TextEditingController();
    final amount = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Gift ${agent.displayName}'),
        content: TextField(
          controller: amountController,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Credits',
            hintText: 'Enter amount',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = int.tryParse(amountController.text.trim());
              if (value != null && value > 0) {
                Navigator.of(dialogContext).pop(value);
              }
            },
            child: const Text('Review gift'),
          ),
        ],
      ),
    );
    amountController.dispose();
    if (amount == null || !mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Send gift?'),
        content: Text('Send $amount Credits as a gift? Gifts do not create referral commission.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final receipt = await ref.read(walletProvider.notifier).sendGift(
      recipientCharacterId: agent.characterId,
      amountCredits: amount,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(receipt == null ? 'Could not send gift.' : 'Gift sent.'),
      ),
    );
  }

  Future<void> _blockAgent(AgentDirectoryEntry agent) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Block ${agent.displayName}?'),
                content: const Text('They will no longer be available to you until you unblock them.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Block'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final ok = await ref.read(twinSafetyControllerProvider.notifier).block(agent.characterId);
    if (!mounted) return;
    if (ok) {
      unawaited(ref.read(agentDirectoryProvider.notifier).refresh());
      context.go('/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not block this Twin.')),
      );
    }
  }

  Future<void> _reportAgent(AgentDirectoryEntry agent) async {
    final selected = await showDialog<TwinReportReason>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: const Text('Report Twin'),
        children: [
          for (final reason in TwinReportReason.values)
            SimpleDialogOption(
              onPressed: () => Navigator.of(dialogContext).pop(reason),
              child: Text(twinReportReasonLabel(reason)),
            ),
        ],
      ),
    );
    if (selected == null) return;
    final ok = await ref.read(twinSafetyControllerProvider.notifier).report(
      characterId: agent.characterId,
      reason: selected,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Report submitted.' : 'Could not submit report.')),
    );
  }
  PaidVoiceController _capturePaidController(
      CallLifecycleOwner owner, CallLifecycleReporter reporter) {
    return PaidVoiceController(GroupPaidVoiceTransport(
      api: ref.read(apiClientProvider),
      accountKey: owner.accountId,
      accessToken: owner.accessToken,
      outbox: ref.read(groupPaidVoiceOutboxProvider),
      currentAccountKey: () => reporter.captureOwner()?.accountId));
  }

  Future<(bool allowed, PaidVoiceAdmission? admission, int? estimatedSeconds)> _admitInlineVoice(
    AgentDirectoryEntry agent, {required PaidVoiceController controller}
  ) async {
    // Personal Twins are retired: every non-support Masana goes through
    // paid admission, preserving billing behavior.
    final requiresPaidAdmission = !agent.supportAgent;
    if (!requiresPaidAdmission) return (true, null, null);

    final quote = await controller.quote(
      characterId: agent.characterId,
      expectedSeconds: 5 * 60,
    );
    if (quote == null || !mounted) return (false, null, null);
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Voice with ${agent.displayName}'),
        content: Text(
          quote.isTrial
              ? 'Your ${quote.trialDurationDays}-day voice trial covers this live conversation.'
              : 'Reserve up to ${quote.spendCapCredits} Credits for about 5 minutes. Only verified live time is charged.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(quote.isTrial ? 'Start voice' : 'Accept & start'),
          ),
        ],
      ),
    );
    if (accepted != true) return (false, null, null);
    final admission = await controller.accept(characterId: agent.characterId);
    return (admission != null, admission, quote.estimatedSeconds);
  }

  void _applyInlineTranscriptChunk(String chunk) {
    final next = chunk.trim();
    if (next.isEmpty || !mounted) return;
    setState(() {
      final current = _inlineCurrentTranscript;
      if (current.isEmpty || next.startsWith(current)) {
        _inlineCurrentTranscript = next;
      } else if (!current.endsWith(next)) {
        final separator =
            current.endsWith(' ') || next.startsWith(' ') ? '' : ' ';
        _inlineCurrentTranscript = current + separator + next;
      }
      _inlineTranscript = [
        if (_inlineTranscriptHistory.trim().isNotEmpty)
          _inlineTranscriptHistory.trim(),
        if (_inlineCurrentTranscript.trim().isNotEmpty)
          _inlineCurrentTranscript.trim(),
      ].join('\n\n');
    });
  }

  void _finishInlineTranscriptTurn() {
    if (!mounted) return;
    final current = _inlineCurrentTranscript.trim();
    if (current.isEmpty) return;
    setState(() {
      _inlineTranscriptHistory = [
        if (_inlineTranscriptHistory.trim().isNotEmpty)
          _inlineTranscriptHistory.trim(),
        current,
      ].join('\n\n');
      _inlineCurrentTranscript = '';
      _inlineTranscript = _inlineTranscriptHistory;
    });
  }

  Future<void> _disposeInlineVoice() async {
    if (_inlineVoiceClosing) return;
    final session = _inlineVoiceSession;
    if (session == null) return;
    _inlineVoiceClosing = true;
    final admission = _inlinePaidAdmission;
    final shellTransport = _inlineShellTransport;
    final characterId = _inlineVoiceCharacterId;
    final paidController = _inlinePaidController;
    final walletController = admission == null
        ? null
        : ref.read(walletProvider.notifier);
    try {
      await _inlineTranscriptSub?.cancel();
      await _inlineVoiceStateSub?.cancel();
      await _inlineTurnSub?.cancel();
      _inlineTranscriptSub = null;
      _inlineVoiceStateSub = null;
      _inlineTurnSub = null;
      await session.close();
      if (admission != null && paidController != null) {
        await paidController
            .complete(
              admissionId: admission.admissionId,
              outcome: 'interrupted',
            )
            .catchError((_) {});
        unawaited(walletController?.refresh() ?? Future<void>.value());
      }
      if (shellTransport != null && characterId != null) {
        await shellTransport
            .setPresence(
              characterId: characterId,
              state: 'available',
              durationMs: 60 * 1000,
            )
            .catchError((_) {});
      }
    } finally {
      _inlineVoiceSession = null;
      _inlinePaidAdmission = null;
      _inlinePaidController = null;
      _inlineShellTransport = null;
      _inlineVoiceCharacterId = null;
      _inlineVoiceClosing = false;
    }
  }

  Future<void> _startInlineLiveVoice(AgentDirectoryEntry agent) async {
    if (_inlineVoiceSession != null) {
      await _stopInlineLiveVoice(outcome: 'completed');
      return;
    }
    if (!await _ensurePermission(AppPermission.microphone, 'Microphone')) {
      return;
    }
    final transport = ref.read(agentTransportProvider);
    if (transport is! AgentShellTransport) {
      if (mounted) _comingSoon('Live voice');
      return;
    }
    final reporter = ref.read(callLifecycleReporterProvider);
    final owner = reporter.captureOwner();
    if (owner == null) return;
    final paidController = _capturePaidController(owner, reporter);
    final walletController = ref.read(walletProvider.notifier);
    final admissionResult = await _admitInlineVoice(agent, controller: paidController);
    final paidAdmission = admissionResult.$2;
    if (!admissionResult.$1) return;
    if (!mounted || reporter.captureOwner()?.accountId != owner.accountId) {
      if (paidAdmission != null) {
        await paidController.complete(admissionId: paidAdmission.admissionId,
            outcome: 'interrupted').catchError((_) {});
      }
      return;
    }

    final shellTransport = transport as AgentShellTransport;
    LiveVoiceSession? session;
    CallLifecycleBinding? history;
    try {
      await _activeVoiceBubble?._pauseFromAnotherBubble();
      await shellTransport.setPresence(
        characterId: agent.characterId,
        state: 'on_call',
        durationMs: 5 * 60 * 1000,
      );
      if (!mounted || reporter.captureOwner()?.accountId != owner.accountId) {
        throw StateError('Call account changed before grant issuance');
      }
      final grant = shellTransport is MasanawaAgentTransport
          ? await shellTransport.mintLiveVoiceGrantPinned(agent.characterId,
              accessToken: owner.accessToken, admissionId: paidAdmission?.admissionId)
          : await shellTransport.mintLiveVoiceGrant(agent.characterId,
              admissionId: paidAdmission?.admissionId, purpose: 'conversation');
      history = reporter.bind(owner, grant.callId);
      if (!mounted || reporter.captureOwner()?.accountId != owner.accountId) {
        await history.closed();
        throw StateError('Voice screen closed before session start');
      }
      session = LiveVoiceSession(
        grant: grant,
        characterName: agent.displayName,
        onConnected: history.connected,
        onClosed: history.closed,
        captureInputTranscription: false,
        endAt: paidAdmission?.expiresAt,
        maxDuration: paidAdmission == null ? null : paidNativeCallMaxDuration(
          estimatedSeconds: admissionResult.$3!,
          admissionExpiresAt: paidAdmission.expiresAt,
          now: DateTime.now(),
        ),
      );

      _inlineTranscriptSub?.cancel();
      _inlineVoiceStateSub?.cancel();
      _inlineTurnSub?.cancel();
      _inlineTranscriptSub =
          session.transcripts.listen(_applyInlineTranscriptChunk);
      _inlineTurnSub = session.turnCompletions.listen((_) {
        _finishInlineTranscriptTurn();
      });
      _inlineVoiceStateSub = session.states.listen((state) {
        if (!mounted) return;
        setState(() => _inlineVoiceState = state);
        if (state == LiveVoiceState.failed || state == LiveVoiceState.ended) {
          unawaited(_stopInlineLiveVoice(outcome: 'interrupted'));
        }
      });

      setState(() {
        _inlineVoiceSession = session;
        _inlinePaidAdmission = paidAdmission;
        _inlinePaidController = paidController;
        _inlineShellTransport = shellTransport;
        _inlineVoiceCharacterId = agent.characterId;
        _inlineTranscript = '';
        _inlineTranscriptHistory = '';
        _inlineCurrentTranscript = '';
        _inlineVoiceState = LiveVoiceState.connecting;
      });

      await Future.wait<void>([session.start(), session.ready]);
      if (paidAdmission != null) {
        await paidController.mediaStarted(admissionId: paidAdmission.admissionId);
      }
    } catch (_) {
      await session?.close();
      await history?.closed();
      if (paidAdmission != null) {
        await paidController.complete(
              admissionId: paidAdmission.admissionId,
              outcome: 'interrupted',
            )
            .catchError((_) {});
        unawaited(walletController.refresh());
      }
      await shellTransport
          .setPresence(
            characterId: agent.characterId,
            state: 'available',
            durationMs: 60 * 1000,
          )
          .catchError((_) {});
      if (mounted) {
        setState(() {
          _inlineVoiceSession = null;
          _inlinePaidAdmission = null;
          _inlinePaidController = null;
          _inlineShellTransport = null;
          _inlineVoiceCharacterId = null;
          _inlineVoiceState = LiveVoiceState.failed;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Live voice could not start. Check microphone access and connection.',
            ),
          ),
        );
      }
    }
  }

  Future<void> _stopInlineLiveVoice({
    required String outcome,
  }) async {
    if (_inlineVoiceClosing) return;
    final session = _inlineVoiceSession;
    if (session == null) return;
    _inlineVoiceClosing = true;
    final admission = _inlinePaidAdmission;
    final shellTransport = _inlineShellTransport;
    final characterId = _inlineVoiceCharacterId;
    try {
      await _inlineTranscriptSub?.cancel();
      await _inlineVoiceStateSub?.cancel();
      await _inlineTurnSub?.cancel();
      _inlineTranscriptSub = null;
      _inlineVoiceStateSub = null;
      _inlineTurnSub = null;
      await session.close();
      if (admission != null) {
        await _inlinePaidController?.complete(
              admissionId: admission.admissionId,
              outcome: outcome,
            )
            .catchError((_) {});
        unawaited(ref.read(walletProvider.notifier).refresh());
      }
      if (shellTransport != null && characterId != null) {
        await shellTransport
            .setPresence(
              characterId: characterId,
              state: 'available',
              durationMs: 60 * 1000,
            )
            .catchError((_) {});
      }
    } finally {
      if (mounted) {
        setState(() {
          _inlineVoiceSession = null;
          _inlinePaidAdmission = null;
          _inlinePaidController = null;
          _inlineShellTransport = null;
          _inlineVoiceCharacterId = null;
          _inlineVoiceState = LiveVoiceState.idle;
        });
      }
      _inlineVoiceClosing = false;
    }
  }

  Future<void> _openLiveVoice(AgentDirectoryEntry agent) async {
    if (!await _ensurePermission(AppPermission.microphone, 'Microphone')) {
      return;
    }
    final transport = ref.read(agentTransportProvider);
    if (transport is! AgentShellTransport) {
      if (mounted) _comingSoon('Live voice');
      return;
    }
    final reporter = ref.read(callLifecycleReporterProvider);
    final owner = reporter.captureOwner();
    if (owner == null) return;
    final shellTransport = transport as AgentShellTransport;
    // Personal Twins are retired: every non-support Masana goes through
    // paid admission, preserving billing behavior.
    final requiresPaidAdmission = !agent.supportAgent;

    final paidController = _capturePaidController(owner, reporter);
    final walletController = ref.read(walletProvider.notifier);
    PaidVoiceAdmission? paidAdmission;
    var estimatedSeconds = 300;
    if (requiresPaidAdmission) {
      final controller = paidController;
      final quote = await controller.quote(
        characterId: agent.characterId,
        expectedSeconds: 5 * 60,
      );
      if (quote != null) {
        estimatedSeconds = quote.estimatedSeconds;
        if (!mounted) return;
        final accepted = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text('Voice with ${agent.displayName}'),
            content: Text(
              quote.isTrial
                  ? 'Your ${quote.trialDurationDays}-day voice trial covers this call. You will not be charged for trial usage.'
                  : 'Reserve up to ${quote.spendCapCredits} Credits for about 5 minutes. Only verified call time is charged and unused Credits are returned.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Not now'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: Text(quote.isTrial ? 'Start trial call' : 'Accept & call'),
              ),
            ],
          ),
        );
        if (accepted != true) return;
        paidAdmission = await controller.accept(characterId: agent.characterId);
        if (paidAdmission == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Could not reserve this voice call.')),
            );
          }
          return;
        }
      }
    }

    LiveVoiceSession? session;
    CallLifecycleBinding? history;
    var verifiedMediaStarted = false;
    try {
      await _activeVoiceBubble?._pauseFromAnotherBubble();
      await shellTransport.setPresence(
        characterId: agent.characterId,
        state: 'on_call',
        durationMs: 5 * 60 * 1000,
      );
      unawaited(ref.read(agentDirectoryProvider.notifier).refresh());
      if (!mounted || reporter.captureOwner()?.accountId != owner.accountId) {
        throw StateError('Call account changed before grant issuance');
      }
      final grant = shellTransport is MasanawaAgentTransport
          ? await shellTransport.mintLiveVoiceGrantPinned(agent.characterId,
              accessToken: owner.accessToken, admissionId: paidAdmission?.admissionId)
          : await shellTransport.mintLiveVoiceGrant(agent.characterId,
              admissionId: paidAdmission?.admissionId);
      history = reporter.bind(owner, grant.callId);
      if (!mounted || reporter.captureOwner()?.accountId != owner.accountId) {
        await history.closed();
        throw StateError('Voice screen closed before call start');
      }
      session = LiveVoiceSession(
        grant: grant,
        characterName: agent.displayName,
        onConnected: history.connected,
        onClosed: history.closed,
        endAt: paidAdmission?.expiresAt,
        maxDuration: paidAdmission == null ? null : paidNativeCallMaxDuration(
          estimatedSeconds: estimatedSeconds,
          admissionExpiresAt: paidAdmission.expiresAt,
          now: DateTime.now(),
        ),
      );
      _modalVoiceSession = session;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        enableDrag: false,
        backgroundColor: Colors.transparent,
        builder: (_) => FractionallySizedBox(
          heightFactor: .92,
          child: _LiveVoiceSheet(
          agent: agent,
          session: session!,
          maxDuration: paidAdmission == null
              ? null
              : Duration(
                  seconds: estimatedSeconds,
                ),
          onMediaStarted: paidAdmission == null
              ? null
              : () async {
                  try {
                    await paidController.mediaStarted(
                          admissionId: paidAdmission!.admissionId,
                        );
                    verifiedMediaStarted = true;
                  } catch (_) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Voice usage could not be verified, so this call was ended without charging you.',
                          ),
                        ),
                      );
                    }
                    rethrow;
                  }
                },
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Live voice could not start. Check microphone access and connection.',
            ),
          ),
        );
      }
    } finally {
      await session?.close();
      await history?.closed();
      if (identical(_modalVoiceSession, session)) _modalVoiceSession = null;
      if (paidAdmission != null) {
        await paidController.complete(
              admissionId: paidAdmission.admissionId,
              outcome: verifiedMediaStarted ? 'completed' : 'interrupted',
            )
            .catchError((_) {});
        unawaited(walletController.refresh());
      }
      await shellTransport
          .setPresence(
            characterId: agent.characterId,
            state: 'available',
            durationMs: 60 * 1000,
          )
          .catchError((_) {});
      if (mounted) {
        unawaited(ref.read(agentDirectoryProvider.notifier).refresh());
      }
    }
  }
  Future<void> _runAgentAction(AiChatMessage message, String action) async {
    final ctl = ref.read(aiChatProvider.notifier);
    final quoted = message.text;
    final prompt = switch (action) {
      'regenerate' => 'Answer my previous request again. Improve the answer and avoid unnecessary repetition.',
      'shorter' => 'Make this answer much shorter while preserving the important points:\n\n$quoted',
      'detail' => 'Expand this answer with more useful detail and practical steps:\n\n$quoted',
      'simple' => 'Explain this much more simply:\n\n$quoted',
      'translate' => 'Translate this answer into the language I am currently using, preserving meaning:\n\n$quoted',
      'continue' => 'Continue this answer exactly from where it stopped:\n\n$quoted',
      'audio' => 'Repeat this answer faithfully so I can listen to the native audio version:\n\n$quoted',
      _ => '',
    };
    if (prompt.isEmpty) return;
    await ctl.sendText(
      widget.characterId,
      prompt,
      replyToId: message.id,
      replyPreview: quoted.isEmpty ? 'Agent response' : quoted,
    );
  }

  Future<void> _editMessage(AiChatMessage message) async {
    final editor = TextEditingController(text: message.text);
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Edit message'),
        content: TextField(
          controller: editor,
          autofocus: true,
          minLines: 1,
          maxLines: 6,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, editor.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    editor.dispose();
    if (result != null) {
      ref.read(aiChatProvider.notifier).editMessage(
        widget.characterId,
        message.id,
        result,
      );
    }
  }

  Future<void> _renameConversation() async {
    final thread = ref.read(aiChatProvider.notifier).threadOf(widget.characterId);
    final editor = TextEditingController(text: thread.title ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Rename conversation'),
        content: TextField(controller: editor, autofocus: true),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, editor.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    editor.dispose();
    if (result != null) {
      ref.read(aiChatProvider.notifier).renameThread(widget.characterId, result);
    }
  }

  void _confirmClear(AgentDirectoryEntry agent) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Clear chat with ${agent.displayName}?'),
        content: const Text(
          'All messages in this conversation will be removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              ref.read(aiChatProvider.notifier).clearThread(widget.characterId);
              Navigator.of(dialogContext).pop();
            },
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }
}

class _LiveVoiceSheet extends StatefulWidget {
  const _LiveVoiceSheet({
    required this.agent,
    required this.session,
    this.maxDuration,
    this.onMediaStarted,
  });

  final AgentDirectoryEntry agent;
  final LiveVoiceSession session;
  final Duration? maxDuration;
  final Future<void> Function()? onMediaStarted;

  @override
  State<_LiveVoiceSheet> createState() => _LiveVoiceSheetState();
}

class _LiveVoiceSheetState extends State<_LiveVoiceSheet> {
  bool _ringing = true;
  bool _muted = false;
  bool _speaker = true;
  String? _error;
  Timer? _durationTimer;

  @override
  void initState() {
    super.initState();
    widget.session.errors.listen((message) {
      if (mounted) setState(() => _error = message);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_beginCallExperience());
    });
  }

  Future<void> _beginCallExperience() async {
    await Future<void>.delayed(const Duration(milliseconds: 850));
    if (!mounted) return;
    setState(() => _ringing = false);
    await _startVerifiedSession();
  }

  Future<void> _startVerifiedSession() async {
    try {
      await Future.wait<void>([
        widget.session.start(),
        widget.session.ready,
      ]);
      await widget.onMediaStarted?.call();
      final maxDuration = widget.maxDuration;
      if (maxDuration != null) {
        _durationTimer?.cancel();
        _durationTimer = Timer(maxDuration, () async {
          await widget.session.close();
          if (mounted) Navigator.of(context).pop();
        });
      }
    } catch (_) {
      await widget.session.close();
      if (!mounted) return;
      setState(() {
        _error ??= 'Voice session could not be verified.';
      });
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    widget.session.close();
    super.dispose();
  }

  String _label(LiveVoiceState state) {
    if (_ringing) return 'Calling…';
    return switch (state) {
        LiveVoiceState.connecting => 'Connecting…',
        LiveVoiceState.listening => _muted ? 'Muted' : 'Listening…',
        LiveVoiceState.speaking => 'Speaking…',
        LiveVoiceState.interrupted => 'Listening…',
        LiveVoiceState.failed => 'Connection problem',
        LiveVoiceState.ended => 'Call ended',
        LiveVoiceState.idle => 'Ready',
      };
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceBg,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 34, 24, 30),
          child: StreamBuilder<LiveVoiceState>(
          stream: widget.session.states,
          initialData: LiveVoiceState.connecting,
          builder: (context, snapshot) {
            final state = snapshot.data ?? LiveVoiceState.connecting;
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                  radius: 38,
                  backgroundColor: u.brand,
                  child: Text(
                    widget.agent.initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  widget.agent.displayName,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    _error ?? _label(state),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _error == null ? u.textMuted : u.emergency,
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _CallControl(
                      label: _muted ? 'Unmute' : 'Mute',
                      icon: _muted ? Icons.mic_off : Icons.mic,
                      selected: _muted,
                      onTap: () async {
                        final next = !_muted;
                        await widget.session.mute(next);
                        if (mounted) setState(() => _muted = next);
                      },
                    ),
                    const SizedBox(width: 24),
                    _CallControl(
                      label: _speaker ? 'Speaker' : 'Earpiece',
                      icon: _speaker ? Icons.volume_up : Icons.hearing,
                      selected: _speaker,
                      onTap: () async {
                        final next = !_speaker;
                        await widget.session.setSpeaker(next);
                        if (mounted) setState(() => _speaker = next);
                      },
                    ),
                    const SizedBox(width: 24),
                    _CallControl(
                      label: 'End',
                      icon: Icons.call_end,
                      danger: true,
                      onTap: () async {
                        await widget.session.close();
                        if (context.mounted) Navigator.of(context).pop();
                      },
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    ),
  );
  }
}

class _CallControl extends StatelessWidget {
  const _CallControl({
    required this.label,
    required this.icon,
    required this.onTap,
    this.selected = false,
    this.danger = false,
  });
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool selected;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final color = danger ? u.emergency : (selected ? u.brand : u.surfaceMuted);
    return Column(
      children: [
        Material(
          color: color,
          shape: const CircleBorder(),
          child: IconButton(
            onPressed: onTap,
            icon: Icon(
              icon,
              color: danger || selected ? Colors.white : u.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: 5),
        Text(label, style: TextStyle(color: u.textMuted, fontSize: 11)),
      ],
    );
  }
}

class _AttachOption extends StatelessWidget {
  const _AttachOption({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Icon(icon, color: Colors.white, size: 24),
            ),
            const SizedBox(height: 6),
            Text(label, style: TextStyle(color: u.textPrimary, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _InlineVoicePanel extends StatelessWidget {
  const _InlineVoicePanel({
    required this.agentName,
    required this.transcript,
    required this.state,
    required this.onStop,
  });

  final String agentName;
  final String transcript;
  final LiveVoiceState state;
  final VoidCallback onStop;

  String get _status => switch (state) {
        LiveVoiceState.connecting => 'Connecting…',
        LiveVoiceState.listening => 'Listening…',
        LiveVoiceState.speaking => 'Speaking…',
        LiveVoiceState.interrupted => 'Listening…',
        LiveVoiceState.failed => 'Connection problem',
        LiveVoiceState.ended => 'Ended',
        LiveVoiceState.idle => 'Ready',
      };

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 6, 10, 2),
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Icon(
            state == LiveVoiceState.speaking
                ? Icons.graphic_eq_rounded
                : Icons.mic_rounded,
            color: u.brand,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 112),
              child: SingleChildScrollView(
                reverse: true,
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Text(
                    transcript.trim().isEmpty
                        ? '$agentName · $_status'
                        : transcript.trim(),
                    style: TextStyle(
                      color: transcript.trim().isEmpty
                          ? u.textMuted
                          : u.textPrimary,
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Stop voice',
            onPressed: onStop,
            icon: const Icon(Icons.stop_circle_outlined),
          ),
        ],
      ),
    );
  }
}

class _CafeSuggestionBar extends StatelessWidget {
  const _CafeSuggestionBar({
    required this.selectedKey,
    required this.onTap,
  });

  final String? selectedKey;
  final ValueChanged<CafeSuggestion> onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(8, 7, 8, 5),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        border: Border(
          bottom: BorderSide(color: u.structuralBorder),
        ),
      ),
      child: Center(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final suggestion in kCafeSuggestions) ...[
                ChoiceChip(
                  label: Text(suggestion.label),
                  selected: selectedKey == suggestion.key,
                  onSelected: (_) => onTap(suggestion),
                  showCheckmark: false,
                  visualDensity: VisualDensity.compact,
                ),
                const SizedBox(width: 6),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.hasText,
    required this.sending,
    required this.onSend,
    required this.onStop,
    required this.onAttach,
    required this.onMic,
    required this.onEmojiToggle,
  });

  final TextEditingController controller;
  final bool hasText;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final VoidCallback onAttach;
  final VoidCallback onMic;
  final VoidCallback onEmojiToggle;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                constraints: const BoxConstraints(minHeight: 48),
                decoration: BoxDecoration(
                  color: u.surfaceCard,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: u.structuralBorder),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _ComposerIcon(
                      tooltip: 'Emoji',
                      icon: Icons.emoji_emotions_outlined,
                      onPressed: onEmojiToggle,
                    ),
                    Expanded(
                      child: TextField(
                        controller: controller,
                        minLines: 1,
                        maxLines: 5,
                        keyboardType: TextInputType.multiline,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.fromLTRB(4, 15, 4, 14),
                        ),
                      ),
                    ),
                    _ComposerIcon(
                      tooltip: 'Attach',
                      icon: Icons.attach_file,
                      onPressed: onAttach,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
            Semantics(
              button: true,
              label: hasText ? 'Send message' : 'Record voice note',
              child: Material(
                  color: u.brand,
                  shape: const CircleBorder(),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: sending ? onStop : (hasText ? onSend : onMic),
                    child: SizedBox(
                      width: 48,
                      height: 48,
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 160),
                        child: Icon(
                          sending
                              ? Icons.stop_rounded
                              : hasText
                              ? Icons.send_rounded
                              : Icons.mic_rounded,
                          key: ValueKey('$sending-$hasText'),
                          color: Colors.white,
                          size: 23,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ComposerIcon extends StatelessWidget {
  const _ComposerIcon({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SizedBox(
      width: 36,
      height: 48,
      child: IconButton(
        tooltip: tooltip,
        padding: EdgeInsets.zero,
        visualDensity: VisualDensity.compact,
        icon: Icon(icon, color: u.textMuted, size: 22),
        onPressed: onPressed,
      ),
    );
  }
}

class _PendingAttachmentStrip extends StatelessWidget {
  const _PendingAttachmentStrip({
    required this.attachments,
    required this.onRemove,
  });

  final List<ChatAttachment> attachments;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      height: 92,
      margin: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: u.structuralBorder),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: attachments.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, index) {
          final attachment = attachments[index];
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: attachment.kind == 'image' ? 74 : 120,
                height: 78,
                decoration: BoxDecoration(
                  color: u.surfaceMuted,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: u.structuralBorder),
                ),
                clipBehavior: Clip.antiAlias,
                child: attachment.kind == 'image'
                    ? Image.file(
                        File(attachment.path),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const Center(child: Icon(Icons.broken_image_outlined)),
                      )
                    : Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              attachment.kind == 'video'
                                  ? Icons.videocam_outlined
                                  : Icons.insert_drive_file_outlined,
                              color: u.brand,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              attachment.name ?? attachment.label,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: u.textPrimary,
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
              Positioned(
                top: -4,
                right: -4,
                child: Material(
                  color: u.surfaceCard,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => onRemove(index),
                    child: Padding(
                      padding: const EdgeInsets.all(3),
                      child: Icon(
                        Icons.close,
                        size: 15,
                        color: u.textPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReplyComposerPreview extends StatelessWidget {
  const _ReplyComposerPreview({
    required this.message,
    required this.onClose,
  });

  final AiChatMessage message;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final preview = message.text.isNotEmpty
        ? message.text
        : message.attachment?.label ?? 'Message';
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 4, 12, 0),
      padding: const EdgeInsets.fromLTRB(10, 7, 4, 7),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(10),
        border: Border(
          left: BorderSide(color: u.brand, width: 3),
          top: BorderSide(color: u.structuralBorder),
          right: BorderSide(color: u.structuralBorder),
          bottom: BorderSide(color: u.structuralBorder),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              preview,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: u.textMuted, fontSize: 12.5),
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.close, size: 18),
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({
    required this.message,
    required this.selected,
    required this.highlighted,
    required this.onSelect,
    required this.onReply,
    required this.onReact,
    required this.onDelete,
    required this.onCopy,
    required this.onForward,
    required this.onShare,
    this.onSaveMedia,
    this.onEdit,
    this.onRetry,
    this.onAgentAction,
    this.onShellAction,
  });

  final AiChatMessage message;
  final bool selected;
  final bool highlighted;
  final VoidCallback onSelect;
  final VoidCallback onReply;
  final ValueChanged<String> onReact;
  final VoidCallback onDelete;
  final VoidCallback onCopy;
  final VoidCallback onForward;
  final VoidCallback onShare;
  final VoidCallback? onSaveMedia;
  final VoidCallback? onEdit;
  final VoidCallback? onRetry;
  final ValueChanged<String>? onAgentAction;
  final ShellActionHandler? onShellAction;

  Future<void> _showActions(BuildContext context) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Reply'),
              onTap: () => Navigator.pop(sheetContext, 'reply'),
            ),
            ListTile(
              leading: const Icon(Icons.copy_outlined),
              title: const Text('Copy'),
              onTap: () => Navigator.pop(sheetContext, 'copy'),
            ),
            if (onEdit != null)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Edit'),
                onTap: () => Navigator.pop(sheetContext, 'edit'),
              ),
            ListTile(
              leading: const Icon(Icons.forward_outlined),
              title: const Text('Forward'),
              onTap: () => Navigator.pop(sheetContext, 'forward'),
            ),
            ListTile(
              leading: const Icon(Icons.share_outlined),
              title: const Text('Share'),
              onTap: () => Navigator.pop(sheetContext, 'share'),
            ),
            if (onSaveMedia != null)
              ListTile(
                leading: const Icon(Icons.download_outlined),
                title: const Text('Save media'),
                onTap: () => Navigator.pop(sheetContext, 'save'),
              ),
            ListTile(
              leading: const Icon(Icons.checklist_outlined),
              title: const Text('Select'),
              onTap: () => Navigator.pop(sheetContext, 'select'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Delete'),
              onTap: () => Navigator.pop(sheetContext, 'delete'),
            ),
            if (!message.isUser) ...[
              const Divider(height: 1),
              for (final item in const [
                ('regenerate', Icons.refresh, 'Regenerate'),
                ('shorter', Icons.compress, 'Shorter'),
                ('detail', Icons.subject, 'More detailed'),
                ('simple', Icons.lightbulb_outline, 'Explain simply'),
                ('translate', Icons.translate, 'Translate'),
                ('audio', Icons.volume_up_outlined, 'Read aloud'),
                ('continue', Icons.playlist_add, 'Continue'),
              ])
                ListTile(
                  leading: Icon(item.$2),
                  title: Text(item.$3),
                  onTap: () => Navigator.pop(sheetContext, 'agent:${item.$1}'),
                ),
            ],
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (final emoji in const ['👍', '❤️', '😂', '😮', '😢', '🙏'])
                    InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => Navigator.pop(sheetContext, 'react:$emoji'),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(emoji, style: const TextStyle(fontSize: 24)),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    if (action == null) return;
    if (action == 'reply') onReply();
    if (action == 'copy') onCopy();
    if (action == 'forward') onForward();
    if (action == 'share') onShare();
    if (action == 'save') onSaveMedia?.call();
    if (action == 'select') onSelect();
    if (action == 'edit') onEdit?.call();
    if (action == 'delete') onDelete();
    if (action.startsWith('react:')) onReact(action.substring(6));
    if (action.startsWith('agent:')) {
      onAgentAction?.call(action.substring(6));
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final isUser = message.isUser;
    final failedParts = message.parts.where(
      (p) => p.kind == AgentMessagePartKind.status && p.status == 'failed',
    );
    final failure = failedParts.isEmpty ? null : failedParts.first;
    final attachments = message.allAttachments;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _showActions(context),
        onHorizontalDragEnd: (details) {
          if ((details.primaryVelocity ?? 0) > 250) onReply();
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 3),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.82,
              ),
              decoration: BoxDecoration(
                color: isUser ? u.bubbleOut : u.surfaceCard,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(14),
                  topRight: const Radius.circular(14),
                  bottomLeft: Radius.circular(isUser ? 14 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 14),
                ),
                border: selected || highlighted
                    ? Border.all(
                        color: highlighted ? u.warning : u.brand,
                        width: 2,
                      )
                    : null,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (message.replyPreview case final preview?
                      when preview.trim().isNotEmpty)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 7),
                      padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                      decoration: BoxDecoration(
                        color: u.surfaceBg.withValues(alpha: .65),
                        borderRadius: BorderRadius.circular(7),
                        border: Border(left: BorderSide(color: u.brand, width: 3)),
                      ),
                      child: Text(
                        preview,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: u.textMuted, fontSize: 12),
                      ),
                    ),
                  if (message.deleted)
                    Text(
                      'This message was deleted',
                      style: TextStyle(
                        color: u.textMuted,
                        fontStyle: FontStyle.italic,
                      ),
                    )
                  else ...[
                    if (attachments.isNotEmpty) ...[
                      _AttachmentGallery(attachments: attachments),
                      if (message.text.isNotEmpty) const SizedBox(height: 6),
                    ],
                    if (message.uploadProgress case final progress?
                        when message.deliveryStatus == 'uploading' ||
                            message.deliveryStatus == 'processing') ...[
                      const SizedBox(height: 6),
                      LinearProgressIndicator(
                        value: message.deliveryStatus == 'processing'
                            ? null
                            : progress,
                        minHeight: 3,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        message.deliveryStatus == 'processing'
                            ? 'Processing attachments…'
                            : 'Uploading ${(progress * 100).round()}%',
                        style: TextStyle(color: u.textMuted, fontSize: 10.5),
                      ),
                    ],
                    if (message.text.isNotEmpty)
                      _RichMessageText(text: message.text),
                    if (message.parts.any((p) => p != failure))
                      MessagePartsView(
                        parts: message.parts.where((p) => p != failure).toList(),
                        onAction: onShellAction,
                      ),
                  ],
                  if (failure != null)
                    TextButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh, size: 18),
                      label: Text(failure.actionLabel ?? 'Try again'),
                    ),
                  const SizedBox(height: 3),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (message.editedAt != null)
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: Text(
                            'edited',
                            style: TextStyle(color: u.textMuted, fontSize: 10),
                          ),
                        ),
                      Text(
                        formatClock(message.createdAt),
                        style: TextStyle(color: u.textMuted, fontSize: 10.5),
                      ),
                      if (message.deliveryStatus == 'streaming') ...[
                        const SizedBox(width: 4),
                        SizedBox(
                          width: 9,
                          height: 9,
                          child: CircularProgressIndicator(
                            strokeWidth: 1.5,
                            color: u.brand,
                          ),
                        ),
                      ],
                      if (isUser) ...[
                        const SizedBox(width: 3),
                        Icon(
                          switch (message.deliveryStatus) {
                            'sending' || 'uploading' || 'processing' =>
                              Icons.schedule,
                            'queued' => Icons.cloud_off_outlined,
                            'failed' => Icons.error_outline,
                            'stopped' => Icons.stop_circle_outlined,
                            'sent' => Icons.done,
                            'read' => Icons.done_all,
                            _ => Icons.done_all,
                          },
                          size: 14,
                          color: message.deliveryStatus == 'failed'
                              ? u.emergency
                              : message.deliveryStatus == 'queued'
                              ? u.warning
                              : message.deliveryStatus == 'read'
                              ? u.tickRead
                              : u.textMuted,
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            if ((message.reaction ?? '').isNotEmpty)
              Positioned(
                right: isUser ? 8 : null,
                left: isUser ? null : 8,
                bottom: -6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: u.surfaceCard,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: u.structuralBorder),
                  ),
                  child: Text(message.reaction!, style: const TextStyle(fontSize: 14)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DateSeparator extends StatelessWidget {
  const _DateSeparator({required this.date});
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final now = DateTime.now();
    final label = _label(now, date);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: u.surfaceCard,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Text(label, style: TextStyle(color: u.textMuted, fontSize: 11)),
        ),
      ),
    );
  }

  String _label(DateTime now, DateTime date) {
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(date.year, date.month, date.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    return '${date.day}/${date.month}/${date.year}';
  }
}

class _RichMessageText extends StatelessWidget {
  const _RichMessageText({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final chunks = text.split('```');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < chunks.length; i++)
          if (i.isEven)
            if (chunks[i].trim().isNotEmpty)
              MarkdownBody(
                data: chunks[i],
                selectable: true,
                onTapLink: (_, href, __) async {
                  if (href == null) return;
                  final uri = Uri.tryParse(href);
                  if (uri != null &&
                      (uri.scheme == 'https' || uri.scheme == 'http')) {
                    await launchUrl(
                      uri,
                      mode: LaunchMode.externalApplication,
                    );
                  }
                },
                styleSheet: MarkdownStyleSheet(
                  p: TextStyle(
                    color: u.textPrimary,
                    fontSize: 15,
                    height: 1.4,
                  ),
                  h1: TextStyle(
                    color: u.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                  h2: TextStyle(
                    color: u.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                  h3: TextStyle(
                    color: u.textPrimary,
                    fontSize: 16.5,
                    fontWeight: FontWeight.w700,
                  ),
                  code: TextStyle(
                    color: u.textPrimary,
                    fontFamily: 'monospace',
                    fontSize: 12.5,
                  ),
                  tableBorder: TableBorder.all(color: u.structuralBorder),
                  tableCellsPadding: const EdgeInsets.all(6),
                ),
              )
          else
            _CodeBlock(raw: chunks[i]),
      ],
    );
  }
}

class _CodeBlock extends StatelessWidget {
  const _CodeBlock({required this.raw});
  final String raw;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final firstBreak = raw.indexOf('\n');
    final value = firstBreak > 0 &&
            RegExp(r'^[a-zA-Z0-9_+#.-]+$').hasMatch(raw.substring(0, firstBreak))
        ? raw.substring(firstBreak + 1).trimRight()
        : raw.trim();
    if (value.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(vertical: 5),
      padding: const EdgeInsets.fromLTRB(10, 10, 4, 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: .07),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: SelectableText(
              value,
              style: TextStyle(
                color: u.textPrimary,
                fontFamily: 'monospace',
                fontSize: 12.5,
                height: 1.35,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Copy code',
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.copy, size: 16),
            onPressed: () => Clipboard.setData(ClipboardData(text: value)),
          ),
        ],
      ),
    );
  }
}

class _AttachmentGallery extends StatelessWidget {
  const _AttachmentGallery({required this.attachments});
  final List<ChatAttachment> attachments;

  @override
  Widget build(BuildContext context) {
    final imageAttachments =
        attachments.where((item) => item.kind == 'image').toList();
    final imagePaths = imageAttachments.map((item) => item.path).toList();

    if (attachments.length == 1) {
      return _AttachmentView(
        attachment: attachments.first,
        imagePaths: imagePaths,
        imageIndex: 0,
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 260),
      child: Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          for (final attachment in attachments)
            SizedBox(
              width: attachment.kind == 'image' ? 126 : 250,
              child: _AttachmentView(
                attachment: attachment,
                imagePaths: imagePaths,
                imageIndex: attachment.kind == 'image'
                    ? imageAttachments.indexOf(attachment)
                    : 0,
              ),
            ),
        ],
      ),
    );
  }
}

class _AttachmentView extends StatelessWidget {
  const _AttachmentView({
    required this.attachment,
    this.imagePaths = const [],
    this.imageIndex = 0,
  });

  final ChatAttachment attachment;
  final List<String> imagePaths;
  final int imageIndex;

  @override
  Widget build(BuildContext context) {
    switch (attachment.kind) {
      case 'image':
        return _ImageAttachment(
          path: attachment.path,
          galleryPaths: imagePaths.isEmpty ? [attachment.path] : imagePaths,
          initialIndex: imageIndex,
        );
      case 'voice':
        return _VoiceBubble(attachment: attachment);
      case 'video':
        return _VideoAttachment(attachment: attachment);
      default:
        return _DocTile(attachment: attachment);
    }
  }
}

class _ImageAttachment extends StatelessWidget {
  const _ImageAttachment({
    required this.path,
    required this.galleryPaths,
    required this.initialIndex,
  });

  final String path;
  final List<String> galleryPaths;
  final int initialIndex;

  @override
  Widget build(BuildContext context) {
    final file = File(path);
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (_) => _ImageGalleryViewer(
            paths: galleryPaths,
            initialIndex: initialIndex,
          ),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.file(
          file,
          width: 220,
          height: galleryPaths.length > 1 ? 126 : null,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 220,
            height: 120,
            color: Colors.black12,
            alignment: Alignment.center,
            child: const Icon(Icons.broken_image_outlined),
          ),
        ),
      ),
    );
  }
}

class _ImageGalleryViewer extends StatefulWidget {
  const _ImageGalleryViewer({
    required this.paths,
    required this.initialIndex,
  });

  final List<String> paths;
  final int initialIndex;

  @override
  State<_ImageGalleryViewer> createState() => _ImageGalleryViewerState();
}

class _ImageGalleryViewerState extends State<_ImageGalleryViewer> {
  late final PageController _controller;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex
        .clamp(0, widget.paths.length - 1)
        .toInt();
    _controller = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Stack(
            children: [
              PageView.builder(
                controller: _controller,
                itemCount: widget.paths.length,
                onPageChanged: (index) => setState(() => _index = index),
                itemBuilder: (_, index) => Center(
                  child: InteractiveViewer(
                    minScale: 0.7,
                    maxScale: 5,
                    child: Image.file(
                      File(widget.paths[index]),
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Photo no longer available on this device.',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 8,
                left: 8,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              if (widget.paths.length > 1)
                Positioned(
                  top: 16,
                  left: 0,
                  right: 0,
                  child: IgnorePointer(
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          '${_index + 1}/${widget.paths.length}',
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

class _VideoAttachment extends StatefulWidget {
  const _VideoAttachment({required this.attachment});
  final ChatAttachment attachment;

  @override
  State<_VideoAttachment> createState() => _VideoAttachmentState();
}

class _VideoAttachmentState extends State<_VideoAttachment> {
  VideoPlayerController? _controller;
  bool _failed = false;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    try {
      final controller = _controller ??= VideoPlayerController.file(
        File(widget.attachment.path),
      );
      if (!controller.value.isInitialized) {
        await controller.initialize();
      }
      if (controller.value.isPlaying) {
        await controller.pause();
      } else {
        await controller.play();
      }
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final controller = _controller;
    final initialized = controller?.value.isInitialized ?? false;
    return GestureDetector(
      onTap: _toggle,
      child: Container(
        width: 230,
        height: 140,
        decoration: BoxDecoration(
          color: Colors.black87,
          borderRadius: BorderRadius.circular(10),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (initialized)
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: controller!.value.size.width,
                  height: controller.value.size.height,
                  child: VideoPlayer(controller),
                ),
              )
            else
              Center(
                child: _failed
                    ? const Icon(Icons.error_outline, color: Colors.white)
                    : Icon(
                        Icons.play_circle_fill,
                        color: u.surfaceCard,
                        size: 48,
                      ),
              ),
            if (initialized)
              Center(
                child: Icon(
                  controller!.value.isPlaying
                      ? Icons.pause_circle_filled
                      : Icons.play_circle_fill,
                  color: Colors.white70,
                  size: 46,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DocTile extends StatelessWidget {
  const _DocTile({required this.attachment});
  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final name = attachment.name ?? 'Document';
    final dot = name.lastIndexOf('.');
    final typeLabel = dot > 0 && dot < name.length - 1
        ? name.substring(dot + 1).toUpperCase()
        : (lookupMimeType(attachment.path)?.split('/').last.toUpperCase() ??
              'FILE');
    final meta = [
      typeLabel,
      if (attachment.sizeBytes != null) formatBytes(attachment.sizeBytes!),
    ].join(' · ');
    return Container(
      width: 220,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(Icons.insert_drive_file, size: 34, color: u.brand),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attachment.name ?? 'Document',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: u.textMuted, fontSize: 11.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VoiceWaveform extends StatelessWidget {
  const _VoiceWaveform({
    required this.values,
    required this.progress,
    required this.enabled,
    required this.onSeek,
  });

  final List<double> values;
  final double progress;
  final bool enabled;
  final ValueChanged<double> onSeek;

  List<double> _fallback() {
    const bars = 34;
    return List<double>.generate(bars, (index) {
      final wave = ((index * 17 + 11) % 23) / 23;
      return 0.2 + (wave * 0.8);
    }, growable: false);
  }

  void _seekFromDx(double dx, double width) {
    if (!enabled || width <= 0) return;
    onSeek((dx / width).clamp(0.0, 1.0).toDouble());
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final bars = values.isEmpty ? _fallback() : values;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (details) => _seekFromDx(details.localPosition.dx, width),
          onHorizontalDragUpdate: (details) =>
              _seekFromDx(details.localPosition.dx, width),
          child: SizedBox(
            height: 34,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                for (var i = 0; i < bars.length; i++) ...[
                  Expanded(
                    child: Align(
                      alignment: Alignment.center,
                      child: Container(
                        width: 2,
                        height:
                            (5 + bars[i].clamp(0.0, 1.0) * 23).toDouble(),
                        decoration: BoxDecoration(
                          color: (i / bars.length) <= progress
                              ? u.brand
                              : u.textMuted.withValues(alpha: .42),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),
                  if (i != bars.length - 1) const SizedBox(width: 1),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

_VoiceBubbleState? _activeVoiceBubble;

class _VoiceBubble extends StatefulWidget {
  const _VoiceBubble({required this.attachment});
  final ChatAttachment attachment;

  @override
  State<_VoiceBubble> createState() => _VoiceBubbleState();
}

class _VoiceBubbleState extends State<_VoiceBubble> {
  AudioPlayer? _player;
  StreamSubscription<PlayerState>? _stateSub;
  StreamSubscription<Duration>? _positionSub;
  bool _playing = false;
  bool _broken = false;
  bool _speakerOn = true;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  double _speed = 1;

  @override
  void dispose() {
    if (identical(_activeVoiceBubble, this)) _activeVoiceBubble = null;
    _stateSub?.cancel();
    _positionSub?.cancel();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _pauseFromAnotherBubble() async {
    if (!_playing) return;
    await _player?.pause();
    if (mounted) setState(() => _playing = false);
  }

  Future<void> _ensurePlayer() async {
    if (_player != null) return;
    final player = AudioPlayer();
    _player = player;
    _stateSub = player.playerStateStream.listen((state) {
      if (!mounted) return;
      if (state.processingState == ProcessingState.completed) {
        setState(() {
          _playing = false;
          _position = Duration.zero;
        });
        player.seek(Duration.zero);
      }
    });
    _positionSub = player.positionStream.listen((value) {
      if (mounted) setState(() => _position = value);
    });
    final duration = await player.setFilePath(widget.attachment.path);
    _duration = duration ??
        Duration(milliseconds: widget.attachment.durationMs ?? 0);
    await player.setSpeed(_speed);
  }

  Future<void> _toggle() async {
    try {
      if (_broken && mounted) setState(() => _broken = false);
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth,
          avAudioSessionMode: AVAudioSessionMode.spokenAudio,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.speech,
            usage: AndroidAudioUsage.voiceCommunication,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: true,
        ),
      );
      await LivePcmAudio.setSpeaker(_speakerOn);
      await _ensurePlayer();
      if (_playing) {
        await _player!.pause();
        if (mounted) setState(() => _playing = false);
        return;
      }
      final other = _activeVoiceBubble;
      if (other != null && !identical(other, this)) {
        await other._pauseFromAnotherBubble();
      }
      _activeVoiceBubble = this;
      if (_position >= _duration && _duration > Duration.zero) {
        await _player!.seek(Duration.zero);
      }
      await _player!.play();
      if (mounted) setState(() => _playing = true);
    } catch (_) {
      await _player?.dispose();
      _player = null;
      await _stateSub?.cancel();
      _stateSub = null;
      await _positionSub?.cancel();
      _positionSub = null;
      if (mounted) {
        setState(() {
          _playing = false;
          _broken = true;
        });
      }
    }
  }

  Future<void> _seek(double fraction) async {
    try {
      await _ensurePlayer();
      final totalMs = _duration.inMilliseconds;
      if (totalMs <= 0) return;
      await _player!.seek(
        Duration(milliseconds: (totalMs * fraction).round()),
      );
    } catch (_) {}
  }

  Future<void> _toggleAudioRoute() async {
    final next = !_speakerOn;
    await LivePcmAudio.setSpeaker(next);
    if (mounted) setState(() => _speakerOn = next);
  }

  Future<void> _cycleSpeed() async {
    final next = _speed == 1
        ? 1.5
        : _speed == 1.5
        ? 2.0
        : 1.0;
    setState(() => _speed = next);
    try {
      await _ensurePlayer();
      await _player!.setSpeed(next);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final fallbackMs = widget.attachment.durationMs ?? 0;
    final totalMs = _duration.inMilliseconds > 0
        ? _duration.inMilliseconds
        : fallbackMs;
    final progress = totalMs <= 0
        ? 0.0
        : (_position.inMilliseconds / totalMs)
              .clamp(0.0, 1.0)
              .toDouble();
    final remaining = totalMs <= 0
        ? formatDurationMs(fallbackMs)
        : formatDurationMs(
            (totalMs - _position.inMilliseconds)
                .clamp(0, totalMs)
                .toInt(),
          );

    return SizedBox(
      width: 235,
      child: Row(
        children: [
          GestureDetector(
            onTap: _toggle,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: u.brand.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _broken
                    ? Icons.refresh
                    : _playing
                    ? Icons.pause
                    : Icons.play_arrow,
                color: u.brand,
              ),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _VoiceWaveform(
                  values: widget.attachment.waveform,
                  progress: progress,
                  enabled: !_broken,
                  onSeek: _seek,
                ),
                Row(
                  children: [
                    Text(
                      _broken ? 'Tap to retry' : remaining,
                      style: TextStyle(color: u.textMuted, fontSize: 11),
                    ),
                    const Spacer(),
                    InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: _cycleSpeed,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        child: Text(
                          '${_speed.toStringAsFixed(_speed == 1 ? 0 : 1)}×',
                          style: TextStyle(
                            color: u.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 2),
          IconButton(
            tooltip: _speakerOn ? 'Use earpiece' : 'Use speaker',
            visualDensity: VisualDensity.compact,
            iconSize: 18,
            onPressed: _toggleAudioRoute,
            icon: Icon(
              _speakerOn ? Icons.volume_up_outlined : Icons.hearing_outlined,
              color: u.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: u.surfaceCard,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(14),
            topRight: Radius.circular(14),
            bottomRight: Radius.circular(14),
            bottomLeft: Radius.circular(4),
          ),
          border: Border.all(color: u.structuralBorder),
        ),
        child: SizedBox(
          width: 44,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (var i = 0; i < 3; i++)
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: u.textMuted,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
