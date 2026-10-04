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
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:audio_session/audio_session.dart';

import '../../agents/agent_directory.dart';
import '../../chat/chat_format.dart';
import '../../chat/message_parts.dart';
import '../../chat/message_parts_view.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

/// One Character conversation. Voice is the primary action while text,
/// attachments and structured work results remain in the same timeline.
class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key, required this.characterId});

  final String characterId;

  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _imagePicker = ImagePicker();
  final _recorder = AudioRecorder();
  bool _showEmoji = false;
  bool _hasText = false;
  bool _recording = false;
  bool _recordingPaused = false;
  bool _recordingLocked = false;
  int _recSeconds = 0;
  Timer? _recTimer;
  Timer? _ampTimer;
  final List<double> _amplitudes = [];
  ChatAttachment? _pendingVoice;
  AiChatMessage? _replyingTo;
  bool _showSearch = false;
  final _search = TextEditingController();
  int _searchIndex = 0;
  bool _nearBottom = true;
  int _newBelow = 0;
  final Set<String> _selectedMessageIds = {};

  @override
  void initState() {
    super.initState();
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
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = ref.read(aiChatProvider.notifier);
      controller.openThread(widget.characterId);
      final draft = controller.threadOf(widget.characterId).draft;
      if (draft.isNotEmpty && _input.text.isEmpty) {
        _input.text = draft;
        _input.selection = TextSelection.collapsed(offset: draft.length);
      }
    });
  }

  @override
  void dispose() {
    _recTimer?.cancel();
    _ampTimer?.cancel();
    _recorder.dispose();
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
    if (text.trim().isEmpty) return;
    final reply = _replyingTo;
    _input.clear();
    ref.read(aiChatProvider.notifier).setDraft(widget.characterId, '');
    setState(() {
      _showEmoji = false;
      _replyingTo = null;
    });
    ref.read(aiChatProvider.notifier).sendText(
      widget.characterId,
      text,
      replyToId: reply?.id,
      replyPreview: reply == null
          ? null
          : (reply.text.isNotEmpty ? reply.text : reply.attachment?.label),
    );
  }

  void _comingSoon(String what) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text('$what are coming soon.')));
  }

  // ---- Attachments ---------------------------------------------------------

  void _openAttachSheet() {
    FocusScope.of(context).unfocus();
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
                  color: const Color(0xFF047857),
                  label: 'Document',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickDocument();
                  },
                ),
                _AttachOption(
                  icon: Icons.photo,
                  color: const Color(0xFF1D4ED8),
                  label: 'Gallery',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickMultipleImages();
                  },
                ),
                _AttachOption(
                  icon: Icons.camera_alt,
                  color: const Color(0xFFD97706),
                  label: 'Camera',
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _pickImage(ImageSource.camera);
                  },
                ),
                _AttachOption(
                  icon: Icons.videocam_outlined,
                  color: const Color(0xFF7C3AED),
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
      final files = await FilePicker.pickFiles(allowMultiple: true);
      if (files.isEmpty) return;
      final attachments = <ChatAttachment>[];
      for (final file in files.take(6)) {
        final path = file.path;
        if (path == null || path.isEmpty) continue;
        final size = await file.length();
        attachments.add(
          ChatAttachment(
            kind: 'doc',
            path: path,
            name: file.name,
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
      if (mounted) _comingSoon('Documents');
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;
      final size = await File(picked.path).length();
      if (!mounted) return;
      await ref
          .read(aiChatProvider.notifier)
          .sendAttachment(
            widget.characterId,
            ChatAttachment(
              kind: 'image',
              path: picked.path,
              name: picked.name,
              sizeBytes: size,
            ),
          );
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
      await ref.read(aiChatProvider.notifier).sendAttachment(
        widget.characterId,
        ChatAttachment(
          kind: 'video',
          path: picked.path,
          name: picked.name,
          sizeBytes: size,
        ),
      );
    } catch (_) {
      if (mounted) _comingSoon('Video');
    }
  }

  // ---- Voice notes ---------------------------------------------------------

  Future<void> _toggleRecording() async {
    if (_recording) {
      await _stopRecording(send: true);
      return;
    }
    try {
      await _activeVoiceBubble?._pauseFromAnotherBubble();
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
      final allowed = await _recorder.hasPermission();
      if (!allowed) {
        if (mounted) _comingSoon('Microphone access');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}/masanawa_voice_${DateTime.now().microsecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 16000,
          numChannels: 1,
        ),
        path: path,
      );
      setState(() {
        _recording = true;
        _recordingPaused = false;
        _recordingLocked = false;
        _pendingVoice = null;
        _recSeconds = 0;
        _amplitudes.clear();
        _showEmoji = false;
      });
      FocusScope.of(context).unfocus();
      _recTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted && !_recordingPaused) setState(() => _recSeconds++);
      });
      _ampTimer = Timer.periodic(const Duration(milliseconds: 140), (_) async {
        if (!_recording || _recordingPaused) return;
        try {
          final amp = await _recorder.getAmplitude();
          if (!mounted) return;
          setState(() {
            final normalized = ((amp.current + 55) / 55).clamp(0.08, 1.0).toDouble();
            _amplitudes.add(normalized);
            if (_amplitudes.length > 42) _amplitudes.removeAt(0);
          });
        } catch (_) {}
      });
    } catch (_) {
      if (mounted) _comingSoon('Voice notes');
    }
  }

  Future<void> _stopRecording({required bool send}) async {
    _recTimer?.cancel();
    _ampTimer?.cancel();
    String? path;
    try {
      path = await _recorder.stop();
    } catch (_) {
      path = null;
    }
    final seconds = _recSeconds;
    setState(() {
      _recording = false;
      _recSeconds = 0;
    });
    if (!send) {
      if (path != null) {
        try {
          await File(path).delete();
        } catch (_) {}
      }
      return;
    }
    if (path == null || path.isEmpty) return;
    setState(() {
      _pendingVoice = ChatAttachment(
        kind: 'voice',
        path: path!,
        durationMs: seconds * 1000,
      );
    });
  }

  Future<void> _togglePauseRecording() async {
    if (!_recording) return;
    try {
      if (_recordingPaused) {
        await _recorder.resume();
      } else {
        await _recorder.pause();
      }
      if (mounted) setState(() => _recordingPaused = !_recordingPaused);
    } catch (_) {}
  }

  Future<void> _sendPendingVoice() async {
    final pending = _pendingVoice;
    if (pending == null) return;
    setState(() => _pendingVoice = null);
    await ref.read(aiChatProvider.notifier).sendAttachment(
      widget.characterId,
      pending,
    );
  }

  Future<void> _deletePendingVoice() async {
    final pending = _pendingVoice;
    setState(() => _pendingVoice = null);
    if (pending != null) {
      try { await File(pending.path).delete(); } catch (_) {}
    }
  }

  String get _recClock {
    final m = _recSeconds ~/ 60;
    final s = (_recSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  // ---- Build ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final directory = ref.watch(agentDirectoryProvider);
    final agent = directory.find(widget.characterId);
    final chat = ref.watch(aiChatProvider);
    final thread = chat.threads[widget.characterId];
    final allMessages = thread?.messages ?? const <AiChatMessage>[];
    final query = _search.text.trim().toLowerCase();
    final messages = query.isEmpty
        ? allMessages
        : allMessages.where((m) => m.text.toLowerCase().contains(query)).toList();
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
        backgroundColor: u.surfaceBg,
        appBar: AppBar(
          backgroundColor: u.surfaceCard,
          elevation: 0,
          leadingWidth: 40,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () =>
                context.canPop() ? context.pop() : context.go('/chats'),
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
                  onChanged: (_) => setState(() => _searchIndex = 0),
                )
              : InkWell(
            onTap: () => context.push('/agents'),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 17,
                  backgroundColor: u.brand,
                  child: Text(
                    agent.initial,
                    style: const TextStyle(
                      color: Colors.white,
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
                          color: u.textPrimary,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        workingLabel,
                        style: TextStyle(
                          color: sending ? u.brand : u.textMuted,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
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
            IconButton(
              tooltip: 'Video call',
              icon: const Icon(Icons.videocam_outlined),
              onPressed: () => _comingSoon('Video calls'),
            ),
            IconButton(
              tooltip: 'Voice call',
              icon: const Icon(Icons.call_outlined),
              onPressed: () => _comingSoon('Voice calls'),
            ),
            IconButton(
              tooltip: 'Agents',
              icon: const Icon(Icons.groups_outlined),
              onPressed: () => context.push('/agents'),
            ),
            PopupMenuButton<String>(
              tooltip: 'More',
              onSelected: (value) async {
                final ctl = ref.read(aiChatProvider.notifier);
                if (value == 'clear') _confirmClear(agent);
                if (value == 'new') await ctl.newContext(widget.characterId);
                if (value == 'pin') ctl.togglePin(widget.characterId);
                if (value == 'archive') ctl.toggleArchive(widget.characterId);
                if (value == 'rename') _renameConversation();
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'new', child: Text('New context')),
                PopupMenuItem(value: 'rename', child: Text('Rename chat')),
                PopupMenuItem(value: 'pin', child: Text('Pin / unpin')),
                PopupMenuItem(value: 'archive', child: Text('Archive / unarchive')),
                PopupMenuDivider(),
                PopupMenuItem(value: 'clear', child: Text('Clear chat')),
              ],
            ),
          ],
        ),
        body: Column(
          children: [
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
                            _ChatBubble(
                          message: message,
                          selected: _selectedMessageIds.contains(message.id),
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
                          onAgentAction: message.isUser
                              ? null
                              : (action) => _runAgentAction(message, action),
                          onRetry: failure == null || sending
                              ? null
                              : () async {
                                  if (failure.actionLabel == 'Sign in') {
                                    await ref
                                        .read(sessionProvider.notifier)
                                        .logout();
                                  } else if (failure.actionLabel ==
                                      'Reconnect') {
                                    if (mounted) context.push('/developer');
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
            if (_replyingTo != null)
              _ReplyComposerPreview(
                message: _replyingTo!,
                onClose: () => setState(() => _replyingTo = null),
              ),
            if (_recording)
              _RecordingBar(
                clock: _recClock,
                amplitudes: _amplitudes,
                recording: true,
                paused: _recordingPaused,
                locked: _recordingLocked,
                onDelete: () => _stopRecording(send: false),
                onPause: _togglePauseRecording,
                onStop: () => _stopRecording(send: true),
                onSend: null,
                onCancelSwipe: () => _stopRecording(send: false),
                onLockSwipe: () => setState(() => _recordingLocked = true),
              )
            else if (_pendingVoice != null)
              _VoicePreviewBar(
                attachment: _pendingVoice!,
                onDelete: _deletePendingVoice,
                onSend: _sendPendingVoice,
              )
            else
              _Composer(
                controller: _input,
                hasText: _hasText,
                sending: sending,
                onSend: _sendText,
                onStop: () => ref.read(aiChatProvider.notifier).stopGeneration(widget.characterId),
                onAttach: _openAttachSheet,
                onCamera: () => _pickImage(ImageSource.camera),
                onMic: _toggleRecording,
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
            if (_showEmoji && !_recording)
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

  void _copySelected(List<AiChatMessage> messages) {
    final text = messages
        .where((m) => _selectedMessageIds.contains(m.id) && !m.deleted)
        .map((m) => m.text.isNotEmpty ? m.text : m.attachment?.label ?? '')
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
    final text = message.text.isNotEmpty
        ? message.text
        : message.attachment?.label ?? '';
    if (text.isEmpty) return;
    await SharePlus.instance.share(ShareParams(text: text));
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

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.hasText,
    required this.sending,
    required this.onSend,
    required this.onStop,
    required this.onAttach,
    required this.onCamera,
    required this.onMic,
    required this.onEmojiToggle,
  });

  final TextEditingController controller;
  final bool hasText;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final VoidCallback onAttach;
  final VoidCallback onCamera;
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
                constraints: const BoxConstraints(minHeight: 52),
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
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.fromLTRB(2, 15, 6, 14),
                        ),
                      ),
                    ),
                    _ComposerIcon(
                      tooltip: 'Attach',
                      icon: Icons.attach_file,
                      onPressed: onAttach,
                    ),
                    if (!hasText)
                      _ComposerIcon(
                        tooltip: 'Camera',
                        icon: Icons.camera_alt_outlined,
                        onPressed: onCamera,
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
                    width: 52,
                    height: 52,
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
      width: 40,
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

class _RecordingBar extends StatelessWidget {
  const _RecordingBar({
    required this.clock,
    required this.amplitudes,
    required this.recording,
    required this.paused,
    required this.locked,
    required this.onDelete,
    required this.onPause,
    required this.onStop,
    required this.onSend,
    required this.onCancelSwipe,
    required this.onLockSwipe,
  });

  final String clock;
  final List<double> amplitudes;
  final bool recording;
  final bool paused;
  final bool locked;
  final VoidCallback onDelete;
  final VoidCallback? onPause;
  final VoidCallback? onStop;
  final VoidCallback? onSend;
  final VoidCallback onCancelSwipe;
  final VoidCallback onLockSwipe;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      top: false,
      child: GestureDetector(
        onHorizontalDragEnd: locked
            ? null
            : (details) {
                if ((details.primaryVelocity ?? 0) < -250) onCancelSwipe();
              },
        onVerticalDragEnd: locked
            ? null
            : (details) {
                if ((details.primaryVelocity ?? 0) < -250) onLockSwipe();
              },
        child: Container(
          margin: const EdgeInsets.fromLTRB(8, 6, 8, 8),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          decoration: BoxDecoration(
            color: u.surfaceCard,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Delete recording',
                icon: const Icon(Icons.delete_outline),
                onPressed: onDelete,
              ),
              if (recording)
                Icon(
                  locked ? Icons.lock : Icons.lock_open,
                  size: 17,
                  color: u.textMuted,
                ),
              if (recording) const SizedBox(width: 6),
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: recording && !paused ? Colors.red : u.textMuted,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 7),
              Text(
                clock,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 32,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      for (final value in amplitudes.take(28))
                        Container(
                          width: 2,
                          height: 4 + (value * 22),
                          decoration: BoxDecoration(
                            color: u.brand.withValues(alpha: .75),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      if (amplitudes.isEmpty)
                        Text(
                          recording
                              ? (locked ? 'Locked recording' : '← cancel   ↑ lock')
                              : 'Voice note ready',
                          style: TextStyle(color: u.textMuted, fontSize: 11),
                        ),
                    ],
                  ),
                ),
              ),
              if (onPause != null)
                IconButton(
                  tooltip: paused ? 'Resume' : 'Pause',
                  icon: Icon(paused ? Icons.mic : Icons.pause),
                  onPressed: onPause,
                ),
              if (onStop != null)
                IconButton(
                  tooltip: 'Preview',
                  icon: const Icon(Icons.stop_circle_outlined),
                  onPressed: onStop,
                ),
              if (onSend != null)
                Material(
                  color: u.brand,
                  shape: const CircleBorder(),
                  child: IconButton(
                    tooltip: 'Send voice note',
                    icon: const Icon(Icons.send_rounded, color: Colors.white),
                    onPressed: onSend,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VoicePreviewBar extends StatelessWidget {
  const _VoicePreviewBar({
    required this.attachment,
    required this.onDelete,
    required this.onSend,
  });

  final ChatAttachment attachment;
  final VoidCallback onDelete;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(8, 6, 8, 8),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
        decoration: BoxDecoration(
          color: u.surfaceCard,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: u.structuralBorder),
        ),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Discard',
              icon: const Icon(Icons.delete_outline),
              onPressed: onDelete,
            ),
            Expanded(child: _VoiceBubble(attachment: attachment)),
            Material(
              color: u.brand,
              shape: const CircleBorder(),
              child: IconButton(
                tooltip: 'Send voice note',
                icon: const Icon(Icons.send_rounded, color: Colors.white),
                onPressed: onSend,
              ),
            ),
          ],
        ),
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
    required this.onSelect,
    required this.onReply,
    required this.onReact,
    required this.onDelete,
    required this.onCopy,
    required this.onForward,
    required this.onShare,
    this.onEdit,
    this.onRetry,
    this.onAgentAction,
  });

  final AiChatMessage message;
  final bool selected;
  final VoidCallback onSelect;
  final VoidCallback onReply;
  final ValueChanged<String> onReact;
  final VoidCallback onDelete;
  final VoidCallback onCopy;
  final VoidCallback onForward;
  final VoidCallback onShare;
  final VoidCallback? onEdit;
  final VoidCallback? onRetry;
  final ValueChanged<String>? onAgentAction;

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
                color: isUser
                    ? Color.lerp(u.surfaceCard, u.success, 0.18)!
                    : u.surfaceCard,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(14),
                  topRight: const Radius.circular(14),
                  bottomLeft: Radius.circular(isUser ? 14 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 14),
                ),
                border: selected
                    ? Border.all(color: u.brand, width: 2)
                    : isUser
                    ? null
                    : Border.all(color: u.structuralBorder),
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
                          message.deliveryStatus == 'sending'
                              ? Icons.schedule
                              : message.deliveryStatus == 'failed'
                              ? Icons.error_outline
                              : Icons.done_all,
                          size: 14,
                          color: message.deliveryStatus == 'failed'
                              ? Colors.red
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
    if (attachments.length == 1) {
      return _AttachmentView(attachment: attachments.first);
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
              child: _AttachmentView(attachment: attachment),
            ),
        ],
      ),
    );
  }
}

class _AttachmentView extends StatelessWidget {
  const _AttachmentView({required this.attachment});

  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    switch (attachment.kind) {
      case 'image':
        return _ImageAttachment(path: attachment.path);
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
  const _ImageAttachment({required this.path});
  final String path;

  @override
  Widget build(BuildContext context) {
    final file = File(path);
    return GestureDetector(
      onTap: () => showDialog<void>(
        context: context,
        builder: (_) => Dialog.fullscreen(
          backgroundColor: Colors.black,
          child: SafeArea(
            child: Stack(
              children: [
                Center(
                  child: InteractiveViewer(
                    minScale: 0.7,
                    maxScale: 5,
                    child: Image.file(
                      file,
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
                Positioned(
                  top: 8,
                  left: 8,
                  child: IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.file(
          file,
          width: 220,
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
                if (attachment.sizeBytes != null)
                  Text(
                    formatBytes(attachment.sizeBytes!),
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
      await session.configure(AudioSessionConfiguration.speech());
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
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 2,
                    thumbShape: const RoundSliderThumbShape(
                      enabledThumbRadius: 5,
                    ),
                    overlayShape: SliderComponentShape.noOverlay,
                  ),
                  child: Slider(
                    value: progress,
                    onChanged: _broken ? null : _seek,
                  ),
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
          const SizedBox(width: 4),
          Icon(Icons.graphic_eq, size: 18, color: u.textMuted),
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
