import 'package:flutter/material.dart';

import 'human_chat_composer_controller.dart';
import 'human_chat_contract.dart';

/// Drop-in human-only C02/C05 compose surface for the F12 Chats integration.
/// Rendering does not turn an AI/Talk thread into a human DM; the caller must
/// supply a verified HumanChatScope and a C02-backed HumanChatSendPort.
class HumanChatComposer extends StatefulWidget {
  const HumanChatComposer({
    super.key,
    required this.controller,
    this.onAttachment,
    this.onVoiceNote,
  });

  final HumanChatComposerController controller;
  /// Must open an actual C04 authorized file picker / upload review flow.
  final Future<void> Function(HumanChatScope)? onAttachment;
  /// Must open an actual C04 recording preview, never an auto-started mic.
  final Future<void> Function(HumanChatScope)? onVoiceNote;

  @override
  State<HumanChatComposer> createState() => _HumanChatComposerState();
}

class _HumanChatComposerState extends State<HumanChatComposer> {
  final TextEditingController _input = TextEditingController();
  final FocusNode _focus = FocusNode();
  bool _emojiOpen = false;
  static const _emoji = ['😀', '😂', '❤️', '👍', '🙏', '😊', '🎉', '💯'];

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_sync);
    _input.addListener(_onDraftChanged);
    widget.controller.load();
  }

  @override
  void didUpdateWidget(covariant HumanChatComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_sync);
      _input.clear();
      widget.controller.addListener(_sync);
      widget.controller.load();
    }
  }

  void _sync() {
    if (!mounted) return;
    final source = widget.controller.text;
    if (_input.text != source) {
      _input.value = TextEditingValue(
        text: source,
        selection: TextSelection.collapsed(offset: source.length),
      );
    }
    setState(() {});
  }

  void _onDraftChanged() {
    if (widget.controller.text != _input.text) {
      widget.controller.updateText(_input.text);
    }
  }

  void _insertEmoji(String emoji) {
    if (widget.controller.hasPending) return;
    final selection = _input.selection;
    final pos = selection.isValid ? selection.start : _input.text.length;
    final end = selection.isValid ? selection.end : pos;
    final merged = _input.text.replaceRange(pos, end, emoji);
    if (merged.length > 4000) return;
    _input.value = TextEditingValue(
      text: merged,
      selection: TextSelection.collapsed(offset: pos + emoji.length),
    );
    _focus.requestFocus();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_sync);
    _input.removeListener(_onDraftChanged);
    _input.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.controller;
    final scheme = Theme.of(context).colorScheme;
    final enabled = state.canEdit;
    final hasText = state.text.trim().isNotEmpty;
    return Material(
      color: scheme.surface,
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (state.quote != null)
            ListTile(
              dense: true,
              leading: const Icon(Icons.reply, size: 20),
              title: const Text('Replying to message'),
              subtitle: Text(
                state.quote!.preview,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: IconButton(
                tooltip: 'Cancel reply',
                onPressed: () => state.setQuote(null),
                icon: const Icon(Icons.close),
              ),
            ),
          if (state.lastServerAcceptedMessageId != null &&
              state.error == null)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Semantics(
                liveRegion: true,
                child: Text('Accepted by server. Delivery/read not confirmed.'),
              ),
            ),
          if (state.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
              child: Semantics(
                liveRegion: true,
                child: Text(state.error!, style: TextStyle(color: scheme.error)),
              ),
            ),
          if (state.hasPending)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Column(
                children: [
                  Text(
                    'Not confirmed by server: ${state.pendingText}',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Wrap(spacing: 8, alignment: WrapAlignment.center, children: [
                    TextButton(
                      onPressed: state.sending || !state.active
                          ? null
                          : state.submit,
                      child: const Text('Retry same message'),
                    ),
                    TextButton(
                      onPressed: state.sending || !state.active
                          ? null
                          : state.discardUnconfirmed,
                      child: const Text('Discard unconfirmed'),
                    ),
                  ]),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              IconButton(
                tooltip: 'Insert emoji',
                onPressed: enabled
                    ? () => setState(() => _emojiOpen = !_emojiOpen)
                    : null,
                icon: const Icon(Icons.emoji_emotions_outlined),
              ),
              if (widget.onAttachment != null)
                IconButton(
                  tooltip: 'Choose attachment',
                  onPressed: enabled
                      ? () => widget.onAttachment!(state.scope)
                      : null,
                  icon: const Icon(Icons.attach_file),
                ),
              Expanded(
                child: TextField(
                  controller: _input,
                  focusNode: _focus,
                  enabled: enabled,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 4000,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Message',
                    counterText: '',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              if (state.sending)
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else if (hasText || state.hasPending)
                IconButton.filled(
                  tooltip: 'Send text message',
                  onPressed: enabled && state.canSubmit ? state.submit : null,
                  icon: const Icon(Icons.send),
                )
              else if (widget.onVoiceNote != null)
                IconButton(
                  tooltip: 'Record voice note',
                  onPressed: enabled
                      ? () => widget.onVoiceNote!(state.scope)
                      : null,
                  icon: const Icon(Icons.mic_none),
                ),
            ]),
          ),
          if (_emojiOpen && enabled)
            SizedBox(
              height: 54,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final emoji in _emoji)
                    TextButton(
                      onPressed: () => _insertEmoji(emoji),
                      child: Text(emoji, style: const TextStyle(fontSize: 24)),
                    ),
                ],
              ),
            ),
        ]),
      ),
    );
  }
}
