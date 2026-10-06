import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import 'work_research_models.dart';

class WorkResearchRoomScreen extends StatelessWidget {
  const WorkResearchRoomScreen({
    super.key,
    required this.kind,
    required this.projection,
    required this.loading,
    this.errorMessage,
    this.onRetry,
    this.onQuickStart,
    this.onOpenArtifact,
    this.onOpenEvidence,
  });

  final WorkResearchRoomKind kind;
  final WorkResearchRoomProjection? projection;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final ValueChanged<WorkResearchQuickStart>? onQuickStart;
  final ValueChanged<WorkResearchArtifact>? onOpenArtifact;
  final ValueChanged<WorkResearchEvidence>? onOpenEvidence;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final view = projection;

    return Scaffold(
      backgroundColor: colors.surfaceBg,
      appBar: AppBar(
        title: Text(
          kind == WorkResearchRoomKind.workBusiness
              ? 'Work & Business'
              : 'Research & Answers',
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async => onRetry?.call(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (loading && view == null)
              const SizedBox(
                height: 420,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (errorMessage != null && view == null)
              _ErrorState(message: errorMessage!, onRetry: onRetry)
            else if (view == null)
              const _EmptyState()
            else ...[
              _RoomHeader(view: view),
              const SizedBox(height: 18),
              if (view.quickStarts.isNotEmpty) ...[
                const _SectionTitle('Start quickly'),
                const SizedBox(height: 10),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final columns = constraints.maxWidth >= 560 ? 3 : 2;
                    final spacing = 10.0;
                    final width =
                        (constraints.maxWidth - spacing * (columns - 1)) / columns;
                    return Wrap(
                      spacing: spacing,
                      runSpacing: spacing,
                      children: [
                        for (final quickStart in view.quickStarts)
                          SizedBox(
                            width: width,
                            child: _QuickStartCard(
                              quickStart: quickStart,
                              onTap: onQuickStart == null
                                  ? null
                                  : () => onQuickStart!(quickStart),
                            ),
                          ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 22),
              ],
              const _SectionTitle('Your work'),
              const SizedBox(height: 10),
              if (view.items.isEmpty)
                _NoWorkYet(kind: kind)
              else
                for (final item in view.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _WorkItemCard(
                      item: item,
                      onOpenArtifact: onOpenArtifact,
                      onOpenEvidence: onOpenEvidence,
                    ),
                  ),
              if (errorMessage != null) ...[
                const SizedBox(height: 8),
                _InlineWarning(message: errorMessage!, onRetry: onRetry),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _RoomHeader extends StatelessWidget {
  const _RoomHeader({required this.view});

  final WorkResearchRoomProjection view;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final isWork = view.kind == WorkResearchRoomKind.workBusiness;
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
            child: Icon(
              isWork ? Icons.work_outline : Icons.manage_search_outlined,
              color: colors.brand,
            ),
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
                const SizedBox(height: 5),
                Text(
                  view.subtitle,
                  style: TextStyle(
                    color: colors.textMuted,
                    fontSize: 13,
                    height: 1.4,
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

class _QuickStartCard extends StatelessWidget {
  const _QuickStartCard({required this.quickStart, required this.onTap});

  final WorkResearchQuickStart quickStart;
  final VoidCallback? onTap;

  IconData get _icon {
    switch (quickStart.iconKey) {
      case 'document':
        return Icons.description_outlined;
      case 'presentation':
        return Icons.slideshow_outlined;
      case 'business':
        return Icons.business_center_outlined;
      case 'research':
        return Icons.travel_explore_outlined;
      case 'compare':
        return Icons.compare_arrows_outlined;
      case 'explain':
        return Icons.lightbulb_outline;
      default:
        return Icons.auto_awesome_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Material(
      color: colors.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 118),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.structuralBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(_icon, size: 22, color: colors.brand),
              const SizedBox(height: 10),
              Text(
                quickStart.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                quickStart.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.textMuted,
                  fontSize: 11,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WorkItemCard extends StatelessWidget {
  const _WorkItemCard({
    required this.item,
    required this.onOpenArtifact,
    required this.onOpenEvidence,
  });

  final WorkResearchItem item;
  final ValueChanged<WorkResearchArtifact>? onOpenArtifact;
  final ValueChanged<WorkResearchEvidence>? onOpenEvidence;

  String get _statusLabel {
    switch (item.status) {
      case WorkResearchItemStatus.queued:
        return 'Queued';
      case WorkResearchItemStatus.working:
        return 'Working';
      case WorkResearchItemStatus.waiting:
        return 'Needs input';
      case WorkResearchItemStatus.completed:
        return 'Completed';
      case WorkResearchItemStatus.failed:
        return 'Could not finish';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _statusLabel,
                style: TextStyle(
                  color: item.status == WorkResearchItemStatus.failed
                      ? colors.emergency
                      : colors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (item.summary.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              item.summary,
              style: TextStyle(
                color: colors.textMuted,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
          if (item.status == WorkResearchItemStatus.queued ||
              item.status == WorkResearchItemStatus.working ||
              item.status == WorkResearchItemStatus.waiting) ...[
            const SizedBox(height: 12),
            LinearProgressIndicator(value: item.progress),
          ],
          if (item.artifacts.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'Files & results',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 7),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                for (final artifact in item.artifacts)
                  ActionChip(
                    avatar: const Icon(Icons.insert_drive_file_outlined, size: 16),
                    label: Text(artifact.label),
                    onPressed: onOpenArtifact == null
                        ? null
                        : () => onOpenArtifact!(artifact),
                  ),
              ],
            ),
          ],
          if (item.evidence.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'Sources',
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 7),
            for (final evidence in item.evidence)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                minLeadingWidth: 24,
                leading: Icon(Icons.link, size: 18, color: colors.brand),
                title: Text(
                  evidence.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textPrimary, fontSize: 12),
                ),
                subtitle: evidence.publisher == null
                    ? null
                    : Text(
                        evidence.publisher!,
                        style: TextStyle(color: colors.textMuted, fontSize: 11),
                      ),
                trailing: Icon(Icons.open_in_new, size: 16, color: colors.textMuted),
                onTap: onOpenEvidence == null
                    ? null
                    : () => onOpenEvidence!(evidence),
              ),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Text(
      text,
      style: TextStyle(
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _NoWorkYet extends StatelessWidget {
  const _NoWorkYet({required this.kind});

  final WorkResearchRoomKind kind;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Column(
        children: [
          Icon(
            kind == WorkResearchRoomKind.workBusiness
                ? Icons.task_alt_outlined
                : Icons.fact_check_outlined,
            color: colors.textMuted,
            size: 34,
          ),
          const SizedBox(height: 10),
          Text(
            kind == WorkResearchRoomKind.workBusiness
                ? 'No work in progress yet.'
                : 'No research in progress yet.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 420,
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

class _InlineWarning extends StatelessWidget {
  const _InlineWarning({required this.message, required this.onRetry});

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
          child: Text(message, style: TextStyle(color: colors.textMuted, fontSize: 12)),
        ),
        if (onRetry != null)
          TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 420,
      child: Center(
        child: Text(
          'This room is not available yet.',
          style: TextStyle(color: colors.textMuted),
        ),
      ),
    );
  }
}
