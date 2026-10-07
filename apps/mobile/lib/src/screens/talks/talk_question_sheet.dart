import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_question_state.dart';
import '../../talks/talk_questions.dart';
import '../../theme/masanawa_theme.dart';

Future<String?> showTalkQuestionSheet(BuildContext context) {
  final controller = TextEditingController();
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) {
      final u = context.masanawa;
      return Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          18,
          20,
          18 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Ask the Host',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Your question goes to the Host’s live question queue.',
              style: TextStyle(color: u.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 14),
            TextField(
              key: const ValueKey('talk-question-input'),
              controller: controller,
              autofocus: true,
              maxLength: 500,
              minLines: 2,
              maxLines: 5,
              decoration: const InputDecoration(
                hintText: 'What would you like them to address?',
              ),
            ),
            const SizedBox(height: 10),
            FilledButton(
              key: const ValueKey('talk-question-submit'),
              onPressed: () {
                final body = controller.text.trim();
                if (body.isNotEmpty) Navigator.of(context).pop(body);
              },
              child: const Text('Send question'),
            ),
          ],
        ),
      );
    },
  ).whenComplete(controller.dispose);
}

Future<void> showTalkHostQuestionsSheet(
  BuildContext context, {
  required String talkId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _TalkHostQuestionsSheet(talkId: talkId),
  );
}

class _TalkHostQuestionsSheet extends ConsumerWidget {
  const _TalkHostQuestionsSheet({required this.talkId});

  final String talkId;

  Future<void> _resolve(
    BuildContext context,
    WidgetRef ref,
    TalkQuestion question,
    TalkQuestionStatus status,
  ) async {
    try {
      await ref.read(talkQuestionTransportProvider).resolve(
            talkId: talkId,
            questionId: question.questionId,
            status: status,
          );
      ref.invalidate(talkHostQuestionsProvider(talkId));
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Couldn’t update that question. Try again.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final questions = ref.watch(talkHostQuestionsProvider(talkId));
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .7,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Audience questions',
                    style: TextStyle(
                      color: u.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () =>
                      ref.invalidate(talkHostQuestionsProvider(talkId)),
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: 'Refresh questions',
                ),
              ],
            ),
          ),
          Expanded(
            child: questions.when(
              data: (items) => items.isEmpty
                  ? Center(
                      child: Text(
                        'No questions waiting.',
                        style: TextStyle(color: u.textMuted),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final question = items[index];
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: u.surfaceCard,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: u.structuralBorder),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                question.authorName.isEmpty
                                    ? 'Listener'
                                    : question.authorName,
                                style: TextStyle(
                                  color: u.textMuted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                question.body,
                                style: TextStyle(
                                  color: u.textPrimary,
                                  fontSize: 14,
                                  height: 1.3,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () => _resolve(
                                      context,
                                      ref,
                                      question,
                                      TalkQuestionStatus.dismissed,
                                    ),
                                    child: const Text('Dismiss'),
                                  ),
                                  const SizedBox(width: 4),
                                  FilledButton.tonal(
                                    onPressed: () => _resolve(
                                      context,
                                      ref,
                                      question,
                                      TalkQuestionStatus.answered,
                                    ),
                                    child: const Text('Answered'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(
                child: TextButton(
                  onPressed: () =>
                      ref.invalidate(talkHostQuestionsProvider(talkId)),
                  child: const Text('Couldn’t load questions. Try again'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
