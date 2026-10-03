import 'dart:async';
import 'dart:io';

import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../agents/agent_directory.dart';
import '../../chat/chat_format.dart';
import '../../chat/message_parts_view.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
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
  int _recSeconds = 0;
  Timer? _recTimer;

  @override
  void initState() {
    super.initState();
    _input.addListener(() {
      final hasText = _input.text.isNotEmpty;
      if (hasText != _hasText) setState(() => _hasText = hasText);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(aiChatProvider.notifier).openThread(widget.characterId);
    });
  }

  @override
  void dispose() {
    _recTimer?.cancel();
    _recorder.dispose();
    _input.dispose();
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
    final text = _input.text;
    if (text.trim().isEmpty) return;
    _input.clear();
    setState(() => _showEmoji = false);
    ref.read(aiChatProvider.notifier).sendText(widget.characterId, text);
  }

  void _comingSoon(String what) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$what are coming soon.')),
    );
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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
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
                    _pickImage(ImageSource.gallery);
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
      final file = files.first;
      final path = file.path;
      if (path == null || path.isEmpty) return;
      final size = await file.length();
      await ref.read(aiChatProvider.notifier).sendAttachment(
            widget.characterId,
            ChatAttachment(
              kind: 'doc',
              path: path,
              name: file.name,
              sizeBytes: size,
            ),
          );
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
      await ref.read(aiChatProvider.notifier).sendAttachment(
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

  // ---- Voice notes ---------------------------------------------------------

  Future<void> _toggleRecording() async {
    if (_recording) {
      await _stopRecording(send: true);
      return;
    }
    try {
      final allowed = await _recorder.hasPermission();
      if (!allowed) {
        if (mounted) _comingSoon('Microphone access');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}/masanawa_voice_${DateTime.now().microsecondsSinceEpoch}.m4a';
      await _recorder.start(const RecordConfig(), path: path);
      setState(() {
        _recording = true;
        _recSeconds = 0;
        _showEmoji = false;
      });
      FocusScope.of(context).unfocus();
      _recTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _recSeconds++);
      });
    } catch (_) {
      if (mounted) _comingSoon('Voice notes');
    }
  }

  Future<void> _stopRecording({required bool send}) async {
    _recTimer?.cancel();
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
    await ref.read(aiChatProvider.notifier).sendAttachment(
          widget.characterId,
          ChatAttachment(
            kind: 'voice',
            path: path,
            durationMs: seconds * 1000,
          ),
        );
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
    final messages = thread?.messages ?? const <AiChatMessage>[];
    final sending = chat.sendingIn.contains(widget.characterId);

    if (agent == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Agent')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Text(
              directory.loading
                  ? 'Loading agent…'
                  : 'This agent is no longer available in your configured roster.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(aiChatProvider.notifier).seedGreeting(
            agent.characterId,
            agent.greeting,
          );
    });

    ref.listen(aiChatProvider, (prev, next) {
      final before = prev?.threads[widget.characterId]?.messages.length ?? 0;
      final after = next.threads[widget.characterId]?.messages.length ?? 0;
      if (before != after || prev?.sendingIn != next.sendingIn) {
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
            onPressed: () => context.canPop()
                ? context.pop()
                : context.go('/chats'),
          ),
          title: InkWell(
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
                        sending ? 'Working…' : agent.presenceLabel,
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
              onSelected: (value) {
                if (value == 'clear') _confirmClear(agent);
              },
              itemBuilder: (_) => const [
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
                          horizontal: 12, vertical: 12),
                      itemCount: messages.length + (sending ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index >= messages.length) {
                          return const _TypingBubble();
                        }
                        return _ChatBubble(message: messages[index]);
                      },
                    ),
            ),
            if (_recording)
              _RecordingBar(
                clock: _recClock,
                onDelete: () => _stopRecording(send: false),
                onSend: () => _toggleRecording(),
              )
            else
              _Composer(
                controller: _input,
                hasText: _hasText,
                sending: sending,
                onSend: _sendText,
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
                child: EmojiPicker(
                  textEditingController: _input,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _confirmClear(AgentDirectoryEntry agent) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Clear chat with ${agent.displayName}?'),
        content: const Text('All messages in this conversation will be removed.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              ref
                  .read(aiChatProvider.notifier)
                  .clearThread(widget.characterId);
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
    required this.onAttach,
    required this.onCamera,
    required this.onMic,
    required this.onEmojiToggle,
  });

  final TextEditingController controller;
  final bool hasText;
  final bool sending;
  final VoidCallback onSend;
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
                decoration: BoxDecoration(
                  color: u.surfaceCard,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: u.structuralBorder),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      tooltip: 'Emoji',
                      icon: Icon(Icons.emoji_emotions_outlined,
                          color: u.textMuted),
                      onPressed: onEmojiToggle,
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: TextField(
                          controller: controller,
                          minLines: 1,
                          maxLines: 4,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => onSend(),
                          decoration: const InputDecoration(
                            hintText: 'Type or tap the mic to talk',
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Attach',
                      icon: Icon(Icons.attach_file, color: u.textMuted),
                      onPressed: onAttach,
                    ),
                    IconButton(
                      tooltip: 'Camera',
                      icon: Icon(Icons.camera_alt_outlined,
                          color: u.textMuted),
                      onPressed: onCamera,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
            GestureDetector(
              onTap: hasText ? onSend : onMic,
              child: Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: u.brand,
                  shape: BoxShape.circle,
                ),
                child: sending && !hasText
                    ? const Center(
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        ),
                      )
                    : Icon(
                        hasText ? Icons.send : Icons.mic,
                        color: Colors.white,
                        size: 22,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecordingBar extends StatelessWidget {
  const _RecordingBar({
    required this.clock,
    required this.onDelete,
    required this.onSend,
  });

  final String clock;
  final VoidCallback onDelete;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(8, 6, 8, 8),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(
          color: u.surfaceCard,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: u.structuralBorder),
        ),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Delete recording',
              icon: const Icon(Icons.delete_outline),
              onPressed: onDelete,
            ),
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              clock,
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            GestureDetector(
              onTap: onSend,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: u.brand,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.send, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message});

  final AiChatMessage message;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final isUser = message.isUser;
    final attachment = message.attachment;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          // Token-driven user bubble: success tint over card, no raw hex.
          color: isUser
              ? Color.lerp(u.surfaceCard, u.success, 0.18)!
              : u.surfaceCard,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(isUser ? 14 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 14),
          ),
          border: isUser ? null : Border.all(color: u.structuralBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (attachment != null) ...[
              _AttachmentView(attachment: attachment, isUser: isUser),
              if (message.text.isNotEmpty) const SizedBox(height: 6),
            ],
            if (message.text.isNotEmpty)
              Text(
                message.text,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
            if (message.parts.isNotEmpty)
              MessagePartsView(parts: message.parts),
            const SizedBox(height: 3),
            Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(
                  formatClock(message.createdAt),
                  style: TextStyle(color: u.textMuted, fontSize: 10.5),
                ),
                if (isUser) ...[
                  const SizedBox(width: 3),
                  Icon(Icons.done_all, size: 14, color: u.textMuted),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentView extends StatelessWidget {
  const _AttachmentView({required this.attachment, required this.isUser});

  final ChatAttachment attachment;
  final bool isUser;

  @override
  Widget build(BuildContext context) {
    switch (attachment.kind) {
      case 'image':
        return _ImageAttachment(path: attachment.path);
      case 'voice':
        return _VoiceBubble(attachment: attachment);
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
        builder: (_) => Dialog(
          insetPadding: const EdgeInsets.all(16),
          child: Image.file(file,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) =>
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('Photo no longer available on this device.'),
                  )),
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
          Icon(Icons.insert_drive_file,
              size: 34, color: u.brand),
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

class _VoiceBubble extends StatefulWidget {
  const _VoiceBubble({required this.attachment});
  final ChatAttachment attachment;

  @override
  State<_VoiceBubble> createState() => _VoiceBubbleState();
}

class _VoiceBubbleState extends State<_VoiceBubble> {
  AudioPlayer? _player;
  StreamSubscription<PlayerState>? _stateSub;
  bool _playing = false;
  bool _broken = false;

  @override
  void dispose() {
    _stateSub?.cancel();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_broken) return;
    try {
      _player ??= AudioPlayer();
      // Subscribe once per player; re-toggling must not stack listeners.
      _stateSub ??= _player!.playerStateStream.listen((s) {
        if (s.processingState == ProcessingState.completed && mounted) {
          setState(() => _playing = false);
        }
      });
      if (_playing) {
        await _player!.pause();
        if (mounted) setState(() => _playing = false);
        return;
      }
      await _player!.setFilePath(widget.attachment.path);
      if (!mounted) return;
      setState(() => _playing = true);
      unawaited(_player!.play());
    } catch (_) {
      if (mounted) setState(() => _broken = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final total = formatDurationMs(widget.attachment.durationMs ?? 0);
    return SizedBox(
      width: 200,
      child: Row(
        children: [
          GestureDetector(
            onTap: _toggle,
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: u.brand.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _broken
                    ? Icons.error_outline
                    : _playing
                        ? Icons.pause
                        : Icons.play_arrow,
                color: u.brand,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: u.textMuted.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _broken ? 'Unavailable' : total,
                  style: TextStyle(color: u.textMuted, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.mic, size: 16, color: u.textMuted),
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
