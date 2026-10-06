import 'package:flutter/material.dart';

import '../theme/masanawa_theme.dart';
import 'home_rooms_publishing_models.dart';

class HomeRoomsPublishingPage extends StatelessWidget {
  const HomeRoomsPublishingPage({
    super.key,
    required this.projection,
    required this.loading,
    this.saving = false,
    this.errorMessage,
    this.onRetry,
    this.onMutation,
  });

  final HomeRoomsPublishingProjection? projection;
  final bool loading;
  final bool saving;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final ValueChanged<PublishingMutationIntent>? onMutation;

  bool get _canMutate => onMutation != null && !saving;

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
        Row(
          children: [
            Expanded(
              child: Text(
                'Home & Rooms publishing',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            if (saving)
              const Padding(
                padding: EdgeInsets.only(left: 12),
                child: SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
          ],
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
                subtitle: Text('Order ${item.sortOrder}'),
                onChanged: !_canMutate
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
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(item.label),
                  subtitle: Text(
                    item.pinnedItemId == null
                        ? 'No pinned article'
                        : 'Pinned: ${item.pinnedItemId}',
                  ),
                  leading: Switch(
                    value: item.visible,
                    onChanged: !_canMutate
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
                  trailing: IconButton(
                    tooltip: 'Change pinned article',
                    icon: const Icon(Icons.push_pin_outlined),
                    onPressed: !_canMutate
                        ? null
                        : () => _showPinDialog(
                              context,
                              item: item,
                              revision: view.revision,
                            ),
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
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(item.label),
                  subtitle: Text('Order ${item.sortOrder}'),
                  leading: Switch(
                    value: item.visible,
                    onChanged: !_canMutate
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
                  trailing: Wrap(
                    spacing: 2,
                    children: [
                      IconButton(
                        tooltip: 'Move earlier',
                        onPressed: !_canMutate || item.sortOrder == 0
                            ? null
                            : () => onMutation!(
                                  PublishingMutationIntent.reorderRoom(
                                    roomKey: item.roomKey,
                                    sortOrder: item.sortOrder - 1,
                                    expectedRevision: view.revision,
                                  ),
                                ),
                        icon: const Icon(Icons.arrow_upward),
                      ),
                      IconButton(
                        tooltip: 'Move later',
                        onPressed: !_canMutate
                            ? null
                            : () => onMutation!(
                                  PublishingMutationIntent.reorderRoom(
                                    roomKey: item.roomKey,
                                    sortOrder: item.sortOrder + 1,
                                    expectedRevision: view.revision,
                                  ),
                                ),
                        icon: const Icon(Icons.arrow_downward),
                      ),
                    ],
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
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: Icon(Icons.smart_toy_outlined, color: colors.brand),
                  title: Text(assistant.displayName),
                  subtitle: Text(
                    '${assistant.position == 'left' ? 'Left card' : 'Right card'} · '
                    '${assistant.visible ? 'Visible' : 'Hidden'}',
                  ),
                  trailing: IconButton(
                    tooltip: 'Edit assistant presentation',
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: !_canMutate
                        ? null
                        : () => _showAssistantDialog(
                              context,
                              assistant: assistant,
                              revision: view.revision,
                            ),
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

  Future<void> _showPinDialog(
    BuildContext context, {
    required NewsCategoryAdminItem item,
    required int revision,
  }) async {
    final controller = TextEditingController(text: item.pinnedItemId ?? '');
    final result = await showDialog<String?>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Pin article in ${item.label}'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Article ID',
            helperText: 'Leave empty to clear the pin.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result == null) return;
    onMutation?.call(
      PublishingMutationIntent.pinNews(
        categoryId: item.categoryId,
        itemId: result.isEmpty ? null : result,
        expectedRevision: revision,
      ),
    );
  }

  Future<void> _showAssistantDialog(
    BuildContext context, {
    required AssistantHomePresentation assistant,
    required int revision,
  }) async {
    final nameController = TextEditingController(text: assistant.displayName);
    var position = assistant.position;
    var visible = assistant.visible;

    final result = await showDialog<_AssistantDraft>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text('Edit ${assistant.displayName}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Display name'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: position,
                decoration: const InputDecoration(labelText: 'Home position'),
                items: const [
                  DropdownMenuItem(value: 'left', child: Text('Left')),
                  DropdownMenuItem(value: 'right', child: Text('Right')),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => position = value);
                },
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: visible,
                title: const Text('Visible on Home'),
                onChanged: (value) => setState(() => visible = value),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final name = nameController.text.trim();
                if (name.isEmpty) return;
                Navigator.of(dialogContext).pop(
                  _AssistantDraft(
                    displayName: name,
                    position: position,
                    visible: visible,
                  ),
                );
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    nameController.dispose();
    if (result == null) return;
    onMutation?.call(
      PublishingMutationIntent.updateAssistant(
        characterId: assistant.characterId,
        displayName: result.displayName,
        position: result.position,
        visible: result.visible,
        expectedRevision: revision,
      ),
    );
  }
}

class _AssistantDraft {
  const _AssistantDraft({
    required this.displayName,
    required this.position,
    required this.visible,
  });

  final String displayName;
  final String position;
  final bool visible;
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
