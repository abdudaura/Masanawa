import 'package:flutter/material.dart';

import 'learning_progress.dart';

/// Embeddable Assistant/Agent learning component, not a sixth navigation tab.
/// Real Gateway/C07 composition supplies an authenticated LearningTransport
/// and U02-backed request-ID issuer before this widget is displayed.
class LearningProgressCard extends StatefulWidget {
  const LearningProgressCard({super.key, required this.controller});

  final LearningProgressController controller;

  @override
  State<LearningProgressCard> createState() => _LearningProgressCardState();
}

class _LearningProgressCardState extends State<LearningProgressCard> {
  final TextEditingController _answer = TextEditingController();
  late int _observedSessionRevision;

  @override
  void initState() {
    super.initState();
    _observedSessionRevision = widget.controller.sessionRevision;
    widget.controller.addListener(_purgeOnSessionChange);
  }

  void _purgeOnSessionChange() {
    if (_observedSessionRevision == widget.controller.sessionRevision) return;
    _observedSessionRevision = widget.controller.sessionRevision;
    _answer.clear(); // Never carry A's private lesson draft into account B.
  }

  @override
  void didUpdateWidget(covariant LearningProgressCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.controller, widget.controller)) {
      oldWidget.controller.removeListener(_purgeOnSessionChange);
      _answer.clear();
      _observedSessionRevision = widget.controller.sessionRevision;
      widget.controller.addListener(_purgeOnSessionChange);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_purgeOnSessionChange);
    _answer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final model = widget.controller;
        final progress = model.checkpoint;
        final disabled = model.busy || model.needsReconciliation;
        final theme = Theme.of(context);

        Widget option(String label, LearningAction action) {
          return OutlinedButton(
            onPressed: disabled ? null : () => model.act(action),
            child: Text(label),
          );
        }

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Learning progress',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                    IconButton(
                      tooltip: 'Refresh saved learning progress',
                      icon: const Icon(Icons.refresh),
                      onPressed: model.busy ? null : model.refresh,
                    ),
                  ],
                ),
                if (model.busy) const LinearProgressIndicator(),
                if (progress == null)
                  const Text('No saved Study lesson yet. You can start in the Assistant.')
                else ...[
                  Text(progress.topic, style: theme.textTheme.titleMedium),
                  Text('Goal: ${progress.goal}'),
                  Text('Level: ${progress.level}'),
                  const SizedBox(height: 8),
                  Text('Last checkpoint: ${progress.checkpoint}'),
                  Text('Next: ${progress.nextStep}',
                      style: theme.textTheme.bodyLarge),
                  if (progress.masteryNotes.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text('What you have learned',
                        style: theme.textTheme.titleSmall),
                    for (final note in progress.masteryNotes)
                      Text('• $note'),
                  ],
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    option('Continue', LearningAction.continueLesson),
                    option('Practice', LearningAction.practice),
                    option('Explain again', LearningAction.explainAgain),
                    option('Simpler', LearningAction.simpler),
                    option('Slower', LearningAction.slower),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _answer,
                  enabled: !disabled,
                  maxLength: 2000,
                  minLines: 1,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'My answer',
                    hintText: 'Write an answer to the current exercise',
                    border: OutlineInputBorder(),
                  ),
                ),
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: FilledButton(
                    onPressed: disabled
                        ? null
                        : () => model.act(
                              LearningAction.answer,
                              answer: _answer.text,
                            ),
                    child: const Text('Check answer'),
                  ),
                ),
                if (model.lastActionState == 'accepted')
                  const Text('Request accepted. Progress will appear after the lesson is saved.'),
                if (model.needsReconciliation)
                  const Text(
                    'Request status is uncertain. Review the original task before trying again.',
                  ),
                if (model.error != null)
                  Text(
                    model.error!,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
