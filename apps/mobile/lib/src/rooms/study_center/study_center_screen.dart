import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import 'study_center_models.dart';

class StudyCenterScreen extends StatefulWidget {
  const StudyCenterScreen({
    super.key,
    required this.projection,
    required this.loading,
    this.errorMessage,
    this.onRetry,
    this.onAction,
  });

  final StudyCenterProjection? projection;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final ValueChanged<StudyCenterActionIntent>? onAction;

  @override
  State<StudyCenterScreen> createState() => _StudyCenterScreenState();
}

class _StudyCenterScreenState extends State<StudyCenterScreen> {
  final _freeResponse = TextEditingController();

  @override
  void dispose() {
    _freeResponse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final view = widget.projection;

    return Scaffold(
      backgroundColor: colors.surfaceBg,
      appBar: AppBar(title: const Text('Study Center')),
      body: RefreshIndicator(
        onRefresh: () async => widget.onRetry?.call(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (widget.loading && view == null)
              const SizedBox(
                height: 430,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (widget.errorMessage != null && view == null)
              _StudyError(
                message: widget.errorMessage!,
                onRetry: widget.onRetry,
              )
            else if (view == null)
              const _StudyEmpty()
            else ...[
              _StudyHeader(view: view),
              const SizedBox(height: 14),
              _ProgressCard(progress: view.progress),
              const SizedBox(height: 14),
              if (view.card != null)
                _StudyCard(
                  card: view.card!,
                  freeResponse: _freeResponse,
                  onAction: widget.onAction,
                )
              else
                _NoCurrentLesson(progress: view.progress),
              if (view.capabilities.voiceEnabled) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: widget.onAction == null
                      ? null
                      : () => widget.onAction!(
                            const StudyCenterActionIntent.listen(),
                          ),
                  icon: const Icon(Icons.graphic_eq),
                  label: const Text('Listen'),
                ),
              ],
              if (widget.errorMessage != null) ...[
                const SizedBox(height: 10),
                _InlineStudyWarning(
                  message: widget.errorMessage!,
                  onRetry: widget.onRetry,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _StudyHeader extends StatelessWidget {
  const _StudyHeader({required this.view});

  final StudyCenterProjection view;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: colors.brand.withValues(alpha: .10),
            child: Icon(Icons.school_outlined, color: colors.brand),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  view.title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  view.topic,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  view.language + ' · ' + view.subtitle,
                  style: TextStyle(
                    color: colors.textMuted,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.progress});

  final StudyProgressProjection progress;

  String get _label {
    switch (progress.continuation) {
      case StudyContinuation.continueLesson:
        return 'Continue';
      case StudyContinuation.reteach:
        return 'Reviewing';
      case StudyContinuation.advance:
        return 'Ready for next';
      case StudyContinuation.complete:
        return 'Completed';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Progress',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                _label,
                style: TextStyle(color: colors.textMuted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 9),
          LinearProgressIndicator(value: progress.fraction),
          const SizedBox(height: 7),
          Text(
            progress.completedSteps.toString() +
                ' of ' +
                progress.totalSteps.toString() +
                ' steps',
            style: TextStyle(color: colors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _StudyCard extends StatelessWidget {
  const _StudyCard({
    required this.card,
    required this.freeResponse,
    required this.onAction,
  });

  final StudyCardProjection card;
  final TextEditingController freeResponse;
  final ValueChanged<StudyCenterActionIntent>? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            card.title,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (card.body.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              card.body,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 14,
                height: 1.45,
              ),
            ),
          ],
          if (card.artifacts.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final artifact in card.artifacts)
                  ActionChip(
                    avatar: const Icon(Icons.description_outlined, size: 16),
                    label: Text(artifact.title),
                    onPressed: onAction == null
                        ? null
                        : () => onAction!(
                              StudyCenterActionIntent.openArtifact(
                                artifact.artifactId,
                              ),
                            ),
                  ),
              ],
            ),
          ],
          if (card.kind == StudyCardKind.singleSelect) ...[
            const SizedBox(height: 14),
            for (final option in card.options)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: OutlinedButton(
                  onPressed: onAction == null
                      ? null
                      : () => onAction!(
                            StudyCenterActionIntent.select(
                              actionToken: card.actionToken!,
                              selectionId: option.selectionId,
                              revision: card.revision,
                            ),
                          ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(option.label),
                  ),
                ),
              ),
          ],
          if (card.kind == StudyCardKind.multiSelect) ...[
            const SizedBox(height: 14),
            for (final option in card.options)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: option.selected,
                title: Text(option.label),
                onChanged: onAction == null
                    ? null
                    : (_) => onAction!(
                          StudyCenterActionIntent.toggle(
                            actionToken: card.actionToken!,
                            selectionId: option.selectionId,
                            revision: card.revision,
                          ),
                        ),
              ),
            const SizedBox(height: 6),
            FilledButton(
              onPressed: onAction == null
                  ? null
                  : () => onAction!(
                        StudyCenterActionIntent.commit(
                          actionToken: card.actionToken!,
                          revision: card.revision,
                        ),
                      ),
              child: const Text('Submit answers'),
            ),
          ],
          if (card.kind == StudyCardKind.freeResponse) ...[
            const SizedBox(height: 14),
            TextField(
              controller: freeResponse,
              minLines: 3,
              maxLines: 7,
              maxLength: 16384,
              decoration: const InputDecoration(
                hintText: 'Write your answer',
              ),
            ),
            const SizedBox(height: 7),
            FilledButton(
              onPressed: onAction == null
                  ? null
                  : () {
                      final value = freeResponse.text.trim();
                      if (value.isEmpty) return;
                      onAction!(
                        StudyCenterActionIntent.freeResponse(
                          actionToken: card.actionToken!,
                          responseText: value,
                          revision: card.revision,
                        ),
                      );
                    },
              child: const Text('Send answer'),
            ),
          ],
          if (card.kind == StudyCardKind.feedback) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(
                  card.feedbackPositive == true
                      ? Icons.check_circle_outline
                      : Icons.info_outline,
                  color: card.feedbackPositive == true
                      ? colors.success
                      : colors.brand,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    card.feedbackPositive == true
                        ? 'Good progress'
                        : 'Keep learning',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _NoCurrentLesson extends StatelessWidget {
  const _NoCurrentLesson({required this.progress});

  final StudyProgressProjection progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Center(
        child: Text(
          progress.continuation == StudyContinuation.complete
              ? 'This lesson is complete.'
              : 'Your next lesson will appear here.',
          style: TextStyle(color: colors.textMuted),
        ),
      ),
    );
  }
}

class _StudyError extends StatelessWidget {
  const _StudyError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 430,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, size: 36, color: colors.textMuted),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textMuted),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}

class _InlineStudyWarning extends StatelessWidget {
  const _InlineStudyWarning({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Row(
      children: [
        Icon(Icons.info_outline, size: 18, color: colors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: TextStyle(color: colors.textMuted, fontSize: 12),
          ),
        ),
        if (onRetry != null)
          TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    );
  }
}

class _StudyEmpty extends StatelessWidget {
  const _StudyEmpty();

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 430,
      child: Center(
        child: Text(
          'Study Center is not available yet.',
          style: TextStyle(color: colors.textMuted),
        ),
      ),
    );
  }
}
