import 'package:flutter/material.dart';

import '../../talks/talk_participation.dart';
import '../../theme/masanawa_theme.dart';

Future<String?> showTalkReactionPicker(BuildContext context) {
  const reactions = ['❤️', '👏', '😂', '💯', '🤔', '🔥'];
  return showModalBottomSheet<String>(
    context: context,
    builder: (context) {
      final u = context.masanawa;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'React',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  for (final reaction in reactions)
                    InkWell(
                      key: ValueKey('talk-reaction-' + reaction),
                      borderRadius: BorderRadius.circular(999),
                      onTap: () => Navigator.of(context).pop(reaction),
                      child: Padding(
                        padding: const EdgeInsets.all(9),
                        child: Text(
                          reaction,
                          style: const TextStyle(fontSize: 27),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}

Future<bool?> showRaiseHandSheet(
  BuildContext context, {
  required TalkHandStatus status,
}) {
  final raised = status == TalkHandStatus.raised;
  final accepted = status == TalkHandStatus.accepted;

  return showModalBottomSheet<bool>(
    context: context,
    builder: (context) {
      final u = context.masanawa;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                accepted
                    ? Icons.mic_rounded
                    : raised
                        ? Icons.back_hand_rounded
                        : Icons.back_hand_outlined,
                size: 38,
                color: u.brandStrong,
              ),
              const SizedBox(height: 10),
              Text(
                accepted
                    ? 'You’re on a Speaker Seat'
                    : raised
                        ? 'Your hand is raised'
                        : 'Ask to speak?',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                accepted
                    ? 'The Host admitted you to the Talk.'
                    : raised
                        ? 'The Host can accept or decline your request.'
                        : 'Human Speaker Seats are free. The Host decides who joins the table.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: u.textMuted,
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
              if (!accepted) ...[
                const SizedBox(height: 18),
                FilledButton(
                  key: const ValueKey('raise-hand-confirm'),
                  onPressed: () => Navigator.of(context).pop(!raised),
                  child: Text(raised ? 'Lower hand' : 'Raise hand'),
                ),
              ],
            ],
          ),
        ),
      );
    },
  );
}
