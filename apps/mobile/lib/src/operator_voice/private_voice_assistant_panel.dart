import 'dart:async';

import 'package:flutter/material.dart';

import 'private_voice_operator.dart';

/// Nested Assistant panel, not a new bottom tab or another AI conversation.
/// The caller supplies canonical paid-voice admission and task/turn submitter.
class PrivateVoiceAssistantPanel extends StatefulWidget {
  const PrivateVoiceAssistantPanel({
    required this.operator,
    required this.accountId,
    required this.characterId,
    required this.characterSessionId,
    required this.characterName,
    required this.admissionId,
    required this.onSubmitReviewed,
    super.key,
  });

  final PrivateVoiceOperator operator;
  final String accountId;
  final String characterId;
  final String characterSessionId;
  final String characterName;
  final String admissionId;
  final Future<void> Function(VoiceReviewDraft) onSubmitReviewed;

  @override
  State<PrivateVoiceAssistantPanel> createState() =>
      _PrivateVoiceAssistantPanelState();
}

class _PrivateVoiceAssistantPanelState
    extends State<PrivateVoiceAssistantPanel> {
  final TextEditingController _text = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _text.text = widget.operator.draftText;
    widget.operator.addListener(_onOperatorChanged);
    unawaited(widget.operator.bindAssistantContext(
      accountId: widget.accountId,
      characterId: widget.characterId,
      characterSessionId: widget.characterSessionId,
    ));
  }

  void _onOperatorChanged() {
    if (!mounted) return;
    final current = widget.operator.draftText;
    if (_text.text != current) {
      _text.value = TextEditingValue(
        text: current,
        selection: TextSelection.collapsed(offset: current.length),
      );
    }
  }

  @override
  void didUpdateWidget(covariant PrivateVoiceAssistantPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.operator != widget.operator) {
      oldWidget.operator.removeListener(_onOperatorChanged);
      widget.operator.addListener(_onOperatorChanged);
      _onOperatorChanged();
    }
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.characterId != widget.characterId ||
        oldWidget.characterSessionId != widget.characterSessionId) {
      // Invalidate drafts/grants on account, persona, or session switch.
      unawaited(widget.operator.bindAssistantContext(
        accountId: widget.accountId,
        characterId: widget.characterId,
        characterSessionId: widget.characterSessionId,
      ));
    }
  }

  @override
  void dispose() {
    widget.operator.removeListener(_onOperatorChanged);
    _text.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    await widget.operator.start(
      accountId: widget.accountId,
      characterId: widget.characterId,
      characterSessionId: widget.characterSessionId,
      characterName: widget.characterName,
      admissionId: widget.admissionId,
    );
  }

  Future<void> _review() async {
    final proposal = widget.operator.review();
    if (proposal == null || _sending) return;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Review before sending'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Only the text below will be submitted to your private Assistant. '
                'Payments, recipients and sharing still require separate confirmation.',
              ),
              const SizedBox(height: 12),
              SelectableText(proposal.text),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Edit'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Send to Assistant'),
          ),
        ],
      ),
    );
    if (!mounted || accepted != true) return;
    setState(() => _sending = true);
    await widget.operator.submitReviewed(
      reviewed: proposal,
      currentAccountId: widget.accountId,
      currentCharacterSessionId: widget.characterSessionId,
      submitToAssistant: widget.onSubmitReviewed,
    );
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.operator,
      builder: (context, _) {
        final voice = widget.operator;
        final connected = voice.isConnected;
        final busy = voice.phase == PrivateVoicePhase.connecting;
        final message = switch (voice.phase) {
          PrivateVoicePhase.idle => 'Microphone off',
          PrivateVoicePhase.connecting => 'Connecting private voice',
          PrivateVoicePhase.listening => 'Microphone on. Listening',
          PrivateVoicePhase.speaking => 'Agent speaking',
          PrivateVoicePhase.interrupted => 'Agent interrupted',
          PrivateVoicePhase.unavailable => 'Private voice unavailable',
        };
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              liveRegion: true,
              child: Text(message, key: const Key('u09_voice_state')),
            ),
            if (voice.error case final error?)
              Text(error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 8),
            Row(
              children: [
                if (connected || busy)
                  FilledButton.icon(
                    key: const Key('u09_stop_voice'),
                    onPressed: () => voice.stop(clearContext: false),
                    icon: const Icon(Icons.stop_circle_outlined),
                    label: const Text('Stop voice'),
                  )
                else
                  FilledButton.icon(
                    key: const Key('u09_start_voice'),
                    onPressed: _start,
                    icon: const Icon(Icons.mic_none),
                    label: const Text('Start private voice'),
                  ),
                if (connected) ...[
                  const SizedBox(width: 8),
                  IconButton(
                    key: const Key('u09_mute_voice'),
                    tooltip: voice.isMuted ? 'Unmute microphone' : 'Mute microphone',
                    onPressed: () => voice.setMuted(!voice.isMuted),
                    icon: Icon(voice.isMuted ? Icons.mic_off_outlined : Icons.mic_outlined),
                  ),
                ],
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Only you and the Assistant are in this conversation.',
                      style: Theme.of(context).textTheme.bodySmall),
                ),
              ],
            ),
            if (voice.lastAgentSpeech case final transcript?)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  '${widget.characterName} said: $transcript',
                  key: const Key('u09_agent_speech'),
                ),
              ),
            const SizedBox(height: 8),
            TextField(
              key: const Key('u09_draft'),
              controller: _text,
              maxLength: 4000,
              maxLines: 3,
              minLines: 1,
              onChanged: (text) {
                try {
                  voice.editDraft(text);
                } on StateError {
                  // The view's account/session was invalidated.
                }
              },
              decoration: const InputDecoration(
                labelText: 'Text or reviewed speech',
                hintText: 'Type what you want the Assistant to do',
                border: OutlineInputBorder(),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                key: const Key('u09_review_draft'),
                onPressed: voice.needsReview && !voice.outcomeUnknown && !voice.isSubmitting && !_sending ? _review : null,
                child: Text(_sending ? 'Sending…' : 'Review and send'),
              ),
            ),
          ],
        );
      },
    );
  }
}
