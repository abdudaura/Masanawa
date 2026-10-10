import 'package:flutter/material.dart';

import 'cached_dm_thread_controller.dart';
import 'protected_dm_cache.dart';

/// Small embedded component for the C02 thread screen, not a second screen.
/// Queued/uncertain text is NEVER shown with the delivered server messages.
class HumanDmOfflineStateView extends StatelessWidget {
  const HumanDmOfflineStateView({super.key, required this.controller});
  final CachedDmThreadController controller;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      if (!controller.sync.active) return const SizedBox.shrink();
      final theme = Theme.of(context);
      return Column(mainAxisSize: MainAxisSize.min, children: [
        if (controller.error != null)
          MaterialBanner(
            content: Text(controller.error!),
            actions: [
              TextButton(onPressed: controller.refresh, child: const Text('Refresh')),
            ],
          ),
        if (controller.refreshing) const LinearProgressIndicator(),
        ...controller.outbox.map((DmQueuedMessage item) => Card(
          child: ListTile(
            title: Text(item.text, maxLines: 2,
                overflow: TextOverflow.ellipsis),
            subtitle: Text(switch (item.state) {
              'uncertain' => 'Status unknown — check before retrying',
              'rejected' => 'Not sent — rejected by server',
              _ => 'Queued — not yet sent',
            }, style: theme.textTheme.bodySmall),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(
                tooltip: 'Retry with original request ID',
                icon: const Icon(Icons.refresh),
                onPressed: item.state == 'rejected' ? null :
                    () => controller.retry(item),
              ),
              IconButton(
                tooltip: 'Discard unsent draft',
                icon: const Icon(Icons.close),
                onPressed: () => controller.discard(item),
              ),
            ]),
          ),
        )),
      ]);
    },
  );
}
