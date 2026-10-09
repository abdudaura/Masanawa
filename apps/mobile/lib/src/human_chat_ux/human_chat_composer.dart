import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'human_chat_composer_controller.dart';

/// Reusable human-only composer. The C08 integrator embeds it in C02's thread.
/// Mic/media/emoji are shown only when a real handler is available.
class HumanChatComposer extends StatefulWidget {
  const HumanChatComposer({
    super.key,
    required this.controller,
    this.onVoiceNote,
    this.onAttachment,
    this.onEmoji,
  });

  final HumanChatComposerController controller;
  final Future<void> Function()? onVoiceNote;
  final VoidCallback? onAttachment, onEmoji;

  @override
  State<HumanChatComposer> createState() => _HumanChatComposerState();
}

class _HumanChatComposerState extends State<HumanChatComposer> {
  final TextEditingController _editor = TextEditingController();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_sync);
    unawaited(widget.controller.restore());
  }

  void _sync() {
    if (!mounted) return;
    if (_editor.text != widget.controller.text) {
      _editor.value = TextEditingValue(
        text: widget.controller.text,
        selection: TextSelection.collapsed(offset: widget.controller.text.length),
      );
    }
  }

  @override
  void didUpdateWidget(covariant HumanChatComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_sync);
      _editor.clear();
      widget.controller.addListener(_sync);
      unawaited(widget.controller.restore());
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_sync);
    _editor.dispose();
    super.dispose();
  }

  Future<void> _confirmDiscard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard unconfirmed send?'),
        content: const Text(
          'The server may already have accepted this message. '
          'Discard only clears the pending message on this device.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep pending')),
          TextButton(onPressed: () => Navigator.pop(context, true),
              child: const Text('Discard locally')),
        ],
      ),
    );
    if (discard == true && mounted) {
      await widget.controller.abandonUnconfirmed();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final state = widget.controller;
        final locked = state.loading || !state.allowed ||
            state.hasPending || state.phase == HumanChatPhase.sending;
        final isEmpty = _editor.text.trim().isEmpty;
        final theme = Theme.of(context);
        return SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (state.replyId != null)
              ListTile(
                dense: true,
                key: const ValueKey('u10-reply-preview'),
                leading: const Icon(Icons.reply_outlined),
                title: const Text('Replying to selected message'),
                subtitle: Text(state.replyPreview ?? 'Message',
                    maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: IconButton(
                  tooltip: 'Cancel reply',
                  onPressed: locked ? null : state.clearReply,
                  icon: const Icon(Icons.close),
                ),
              ),
            if (state.notice != null)
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  child: Text(state.notice!,
                    key: const ValueKey('u10-notice'),
                    style: theme.textTheme.bodySmall),
                ),
              ),
            if (state.hasPending)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Column(children: [
                  Text(
                    state.phase == HumanChatPhase.sending
                      ? 'Checking and sending…'
                      : 'Not confirmed: ' + (state.pendingBody ?? ''),
                    maxLines: 3, overflow: TextOverflow.ellipsis,
                    key: const ValueKey('u10-uncertain'),
                  ),
                  Wrap(spacing: 8, children: [
                    TextButton.icon(
                      key: const ValueKey('u10-retry'),
                      onPressed: state.canRetry
                        ? () { unawaited(state.retry()); } : null,
                      icon: const Icon(Icons.sync),
                      label: const Text('Check / retry same send'),
                    ),
                    TextButton(
                      key: const ValueKey('u10-discard'),
                      onPressed: state.phase == HumanChatPhase.sending
                        ? null : _confirmDiscard,
                      child: const Text('Discard locally'),
                    ),
                  ]),
                ]),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (widget.onEmoji != null)
                    IconButton(
                      tooltip: 'Choose emoji',
                      onPressed: locked ? null : widget.onEmoji,
                      icon: const Icon(Icons.emoji_emotions_outlined),
                    ),
                  if (widget.onAttachment != null)
                    IconButton(
                      tooltip: 'Attach private file',
                      onPressed: locked ? null : widget.onAttachment,
                      icon: const Icon(Icons.attach_file),
                    ),
                  Expanded(
                    child: TextField(
                      key: const ValueKey('u10-human-text'),
                      controller: _editor,
                      enabled: !locked,
                      minLines: 1, maxLines: 5,
                      maxLength: 4000,
                      maxLengthEnforcement: MaxLengthEnforcement.enforced,
                      keyboardType: TextInputType.multiline,
                      textCapitalization: TextCapitalization.sentences,
                      textInputAction: TextInputAction.newline,
                      decoration: const InputDecoration(
                        hintText: 'Message',
                        counterText: '',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                      onChanged: state.edit,
                    ),
                  ),
                  const SizedBox(width: 6),
                  if (isEmpty && widget.onVoiceNote != null)
                    IconButton.filled(
                      key: const ValueKey('u10-voice'),
                      tooltip: 'Record private voice note',
                      onPressed: locked
                        ? null : () { unawaited(widget.onVoiceNote!()); },
                      icon: const Icon(Icons.mic),
                    )
                  else
                    IconButton.filled(
                      key: const ValueKey('u10-send'),
                      tooltip: 'Send human message',
                      onPressed: state.canSend
                        ? () { unawaited(state.submit()); } : null,
                      icon: const Icon(Icons.send),
                    ),
                ],
              ),
            ),
          ]),
        );
      },
    );
  }
}
