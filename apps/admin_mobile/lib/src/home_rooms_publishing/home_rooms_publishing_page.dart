import 'package:flutter/material.dart';

import '../theme/masanawa_theme.dart';
import 'home_rooms_publishing_models.dart';

class HomeRoomsPublishingPage extends StatelessWidget {
  const HomeRoomsPublishingPage({
    super.key,
    required this.projection,
    required this.loading,
    this.errorMessage,
    this.onRetry,
    this.onMutation,
  });

  final HomeRoomsPublishingProjection? projection;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final ValueChanged<PublishingMutationIntent>? onMutation;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final view = projection;
    if (loading && view == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (errorMessage != null && view == null) {
      return _PublishingError(message: errorMessage!, onRetry: onRetry);
    }
    if (view == null) {
      return Center(
        child: Text(
          'Publishing controls are not available yet.',
          style: TextStyle(color: colors.textMuted),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Home & Rooms publishing',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 4),
        Text(
          'Control customer-visible publishing through authorized platform commands.',
          style: TextStyle(color: colors.textMuted),
        ),
        const SizedBox(height: 18),
        _Section(
          title: 'Story Radio',
          children: [
            for (final item in view.storySeries)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: item.published,
                title: Text(item.title),
                subtitle: Text('Order ' + item.sortOrder.toString()),
                onChanged: onMutation == null
                    ? null
                    : (value) => onMutation!(
                          PublishingMutationIntent.setVisibility(
                            kind: PublishingMutationKind.setStoryVisibility,
                            targetId: item.seriesId,
                            visible: value,
                            expectedRevision: view.revision,
                          ),
                        ),
              ),
          ],
        ),
        _Section(
          title: 'News',
          children: [
            for (final item in view.newsCategories)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: item.visible,
                title: Text(item.label),
                subtitle: Text(
                  item.pinnedItemId == null
                      ? 'No pinned article'
                      : 'Pinned: ' + item.pinnedItemId!,
                ),
                onChanged: onMutation == null
                    ? null
                    : (value) => onMutation!(
                          PublishingMutationIntent.setVisibility(
                            kind: PublishingMutationKind.setNewsCategoryVisibility,
                            targetId: item.categoryId,
                            visible: value,
                            expectedRevision: view.revision,
                          ),
                        ),
              ),
          ],
        ),
        _Section(
          title: 'Home Rooms',
          children: [
            for (final item in view.homeRooms)
              Card(
                child: ListTile(
                  title: Text(item.label),
                  subtitle: Text('Order ' + item.sortOrder.toString()),
                  trailing: Switch(
                    value: item.visible,
                    onChanged: onMutation == null
                        ? null
                        : (value) => onMutation!(
                              PublishingMutationIntent.setVisibility(
                                kind: PublishingMutationKind.setHomeRoomVisibility,
                                targetId: item.roomKey,
                                visible: value,
                                expectedRevision: view.revision,
                              ),
                            ),
                  ),
                ),
              ),
          ],
        ),
        _Section(
          title: 'Home assistants',
          children: [
            for (final assistant in view.assistants)
              Card(
                child: ListTile(
                  leading: Icon(Icons.smart_toy_outlined, color: colors.brand),
                  title: Text(assistant.displayName),
                  subtitle: Text(
                    assistant.position == 'left' ? 'Left card' : 'Right card',
                  ),
                  trailing: Chip(
                    label: Text(assistant.visible ? 'Visible' : 'Hidden'),
                  ),
                ),
              ),
          ],
        ),
        if (errorMessage != null) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  errorMessage!,
                  style: TextStyle(color: colors.textMuted),
                ),
              ),
              if (onRetry != null)
                TextButton(onPressed: onRetry, child: const Text('Retry')),
            ],
          ),
        ],
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (children.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('Nothing configured yet.'),
                  )
                else
                  ...children,
              ],
            ),
          ),
        ),
      );
}

class _PublishingError extends StatelessWidget {
  const _PublishingError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 48),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ],
          ),
        ),
      );
}
