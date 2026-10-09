import 'package:flutter/material.dart';

import 'controller.dart';
import 'models.dart';

/// Host-only nested Talk surface. Must be mounted by F12/R04 only after server
/// Host/Seat authority is composed. Never emits an AI turn without review.
class HostCopilotPanel extends StatefulWidget {
  const HostCopilotPanel({
    super.key, required this.controller, required this.accountSessionKey,
    required this.talkId, required this.seatId,
  });
  final HostCopilotController controller;
  final String accountSessionKey;
  final String talkId;
  final String seatId;

  @override
  State<HostCopilotPanel> createState() => _HostCopilotPanelState();
}

class _HostCopilotPanelState extends State<HostCopilotPanel> {
  final TextEditingController _question = TextEditingController();
  @override
  void initState() {
    super.initState();
    widget.controller.openScope(
      accountSessionKey: widget.accountSessionKey,
      talkId: widget.talkId, seatId: widget.seatId,
    );
  }

  @override
  void didUpdateWidget(covariant HostCopilotPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountSessionKey != widget.accountSessionKey ||
        oldWidget.talkId != widget.talkId || oldWidget.seatId != widget.seatId ||
        oldWidget.controller != widget.controller) {
      _question.clear();
      widget.controller.openScope(
        accountSessionKey: widget.accountSessionKey,
        talkId: widget.talkId, seatId: widget.seatId,
      );
    }
  }

  Future<void> _approve() async {
    final question = _question.text.trim();
    if (question.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Approve AI Seat turn?'),
        content: Text(
          'This sends your reviewed words to the already-admitted AI Seat. '
          'It may use the Seat turn budget; it does not buy a new Seat.\n\n'
          + question,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true),
            child: const Text('Approve turn')),
        ],
      ),
    );
    if (!mounted || ok != true) return;
    await widget.controller.approve(question);
  }

  @override
  void dispose() {
    _question.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final state = widget.controller;
      final receipt = state.lastReceipt;
      final unknown = state.blockedOnUnknown;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Host AI copilot', style: Theme.of(context).textTheme.titleMedium),
          const Text('Public Talk suggestions only. You control when the AI speaks.'),
          TextButton.icon(
            onPressed: state.busy ? null : state.refresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Suggest next question'),
          ),
          if (state.busy) const LinearProgressIndicator(),
          for (final suggestion in state.suggestions)
            ListTile(
              dense: true,
              title: Text(suggestion.prompt),
              subtitle: const Text('Public Talk context — verify before use'),
              trailing: const Icon(Icons.edit_outlined),
              onTap: unknown || state.busy ? null : () {
                _question.text = suggestion.prompt;
                setState(() {});
              },
            ),
          TextField(
            controller: _question,
            maxLength: 500, maxLines: 3, minLines: 1,
            enabled: !unknown && !state.busy,
            decoration: const InputDecoration(
              labelText: 'Question for the AI Seat',
              hintText: 'Write or edit what the AI should address',
            ),
          ),
          if (state.error != null)
            Text(state.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          if (receipt != null)
            Semantics(
              liveRegion: true,
              child: Text(switch (receipt.status) {
                HostCopilotStatus.published =>
                  'Server accepted the AI turn for audio publication; audibility is not verified.',
                HostCopilotStatus.uncertain || HostCopilotStatus.inProgress =>
                  'Publication status uncertain. Do not start another turn.',
                HostCopilotStatus.budgetExhausted =>
                  'Hourly AI turn budget reached.',
                HostCopilotStatus.denied =>
                  'AI turn denied by current Host or Seat policy.',
                HostCopilotStatus.conflict =>
                  'Request changed or conflicted. Refresh before trying again.',
              }),
            ),
          FilledButton.icon(
            onPressed: unknown || state.busy || _question.text.trim().isEmpty
                ? null : _approve,
            icon: const Icon(Icons.record_voice_over_outlined),
            label: const Text('Review AI turn'),
          ),
        ],
      );
    },
  );
}
