import 'package:flutter/material.dart';

import '../../talks/talk_polls.dart';
import '../../theme/masanawa_theme.dart';

Future<TalkPollDraft?> showCreateTalkPollSheet(BuildContext context) {
  return showModalBottomSheet<TalkPollDraft>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _CreateTalkPollSheet(),
  );
}

class _CreateTalkPollSheet extends StatefulWidget {
  const _CreateTalkPollSheet();

  @override
  State<_CreateTalkPollSheet> createState() => _CreateTalkPollSheetState();
}

class _CreateTalkPollSheetState extends State<_CreateTalkPollSheet> {
  final _question = TextEditingController();
  final List<TextEditingController> _options = [
    TextEditingController(),
    TextEditingController(),
  ];

  @override
  void dispose() {
    _question.dispose();
    for (final controller in _options) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addOption() {
    if (_options.length >= 4) return;
    setState(() => _options.add(TextEditingController()));
  }

  void _removeOption(int index) {
    if (_options.length <= 2) return;
    final removed = _options.removeAt(index);
    removed.dispose();
    setState(() {});
  }

  void _submit() {
    final question = _question.text.trim();
    final options = _options.map((item) => item.text.trim()).toList();
    if (question.isEmpty || options.any((item) => item.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add a question and at least two choices.')),
      );
      return;
    }
    final normalized = options.map((item) => item.toLowerCase()).toSet();
    if (normalized.length != options.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Poll choices must be different.')),
      );
      return;
    }
    Navigator.of(context).pop(
      TalkPollDraft(question: question, options: options),
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        18 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Start a poll',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Ask one clear question. Listeners can change their choice while the poll is open.',
              style: TextStyle(color: u.textMuted, fontSize: 13, height: 1.3),
            ),
            const SizedBox(height: 14),
            TextField(
              key: const ValueKey('talk-poll-question'),
              controller: _question,
              maxLength: 240,
              maxLines: 2,
              decoration: const InputDecoration(hintText: 'Poll question'),
            ),
            const SizedBox(height: 6),
            for (var index = 0; index < _options.length; index++) ...[
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: ValueKey('talk-poll-option-$index'),
                      controller: _options[index],
                      maxLength: 120,
                      decoration: InputDecoration(
                        hintText: 'Choice ${index + 1}',
                        counterText: '',
                      ),
                    ),
                  ),
                  if (_options.length > 2)
                    IconButton(
                      onPressed: () => _removeOption(index),
                      tooltip: 'Remove choice',
                      icon: const Icon(Icons.remove_circle_outline_rounded),
                    ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            if (_options.length < 4)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  key: const ValueKey('talk-poll-add-option'),
                  onPressed: _addOption,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Add choice'),
                ),
              ),
            const SizedBox(height: 10),
            FilledButton(
              key: const ValueKey('talk-poll-create'),
              onPressed: _submit,
              child: const Text('Start poll'),
            ),
          ],
        ),
      ),
    );
  }
}

class TalkPollCard extends StatelessWidget {
  const TalkPollCard({
    required this.poll,
    required this.isHost,
    required this.busy,
    this.onVote,
    this.onClose,
  });

  final TalkPoll poll;
  final bool isHost;
  final bool busy;
  final ValueChanged<String>? onVote;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      key: const ValueKey('talk-poll-card'),
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 2),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.poll_outlined, size: 18, color: u.brandStrong),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  poll.isOpen ? 'Live poll' : 'Poll ended',
                  style: TextStyle(
                    color: u.brandStrong,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                '${poll.totalVotes} ${poll.totalVotes == 1 ? 'vote' : 'votes'}',
                style: TextStyle(color: u.textMuted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            poll.question,
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 16,
              height: 1.25,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          for (final option in poll.options) ...[
            _PollOption(
              option: option,
              totalVotes: poll.totalVotes,
              selected: poll.myOptionId == option.optionId,
              enabled: poll.isOpen && !isHost && !busy,
              onTap: onVote == null ? null : () => onVote!(option.optionId),
            ),
            const SizedBox(height: 8),
          ],
          if (busy)
            const Padding(
              padding: EdgeInsets.only(top: 2),
              child: LinearProgressIndicator(minHeight: 2),
            ),
          if (isHost && poll.isOpen)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                key: const ValueKey('talk-poll-close'),
                onPressed: busy ? null : onClose,
                child: const Text('Close poll'),
              ),
            ),
        ],
      ),
    );
  }
}

class _PollOption extends StatelessWidget {
  const _PollOption({
    required this.option,
    required this.totalVotes,
    required this.selected,
    required this.enabled,
    this.onTap,
  });

  final TalkPollOption option;
  final int totalVotes;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final fraction =
        totalVotes <= 0 ? 0.0 : option.voteCount / totalVotes.toDouble();
    final percent = (fraction * 100).round();
    return Semantics(
      selected: selected,
      button: enabled,
      label: '${option.label}, $percent percent',
      child: InkWell(
        key: ValueKey('talk-poll-option-${option.optionId}'),
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? u.brand.withValues(alpha: .10)
                : u.surfaceMuted,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? u.brandStrong : u.structuralBorder,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                size: 18,
                color: selected ? u.brandStrong : u.textMuted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  option.label,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 13.5,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '$percent%',
                style: TextStyle(
                  color: u.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
