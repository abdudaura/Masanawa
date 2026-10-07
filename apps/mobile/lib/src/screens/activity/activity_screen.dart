import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../agents/twin_activity.dart';
import '../../owner_access/owner_access.dart';
import '../../owner_access/owner_access_state.dart';
import '../../state/twin_activity_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/agent_directory_state.dart';
import '../../theme/masanawa_theme.dart';

class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({super.key});

  TwinActivityItem? _firstPendingOwnerRequest(List<TwinActivityItem> items) {
    for (final item in items) {
      if (item.kind == TwinActivityKind.ownerRequest &&
          item.status == TwinActivityStatus.pending &&
          item.referenceId != null) {
        return item;
      }
    }
    return null;
  }

  Future<DateTime?> _pickSchedule(BuildContext context) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !context.mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 1))),
    );
    if (time == null) return null;
    final value = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    if (!value.isAfter(DateTime.now())) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Choose a future time.')),
        );
      }
      return null;
    }
    return value;
  }

  String _stateLabel(OwnerAccessState state) {
    return switch (state) {
      OwnerAccessState.requested => 'Waiting for your response',
      OwnerAccessState.accepted => 'Accepted — choose a time or start now',
      OwnerAccessState.scheduled => 'Scheduled',
      OwnerAccessState.active => 'In progress',
      OwnerAccessState.completed => 'Completed',
      OwnerAccessState.settled => 'Settled',
      OwnerAccessState.releasing => 'Releasing earnings',
      OwnerAccessState.declined => 'Declined',
      OwnerAccessState.expired => 'Expired',
      OwnerAccessState.cancelled => 'Cancelled',
      OwnerAccessState.noShow => 'No-show',
      OwnerAccessState.refunded => 'Refunded',
      OwnerAccessState.disputed => 'Under review',
    };
  }

  Future<void> _manageOwnerRequest(
    BuildContext context,
    WidgetRef ref, {
    required String characterId,
    required TwinActivityItem item,
  }) async {
    final requestId = item.referenceId;
    if (requestId == null) return;
    final controller = ref.read(ownerAccessControllerProvider.notifier);
    final request = await controller.read(
      characterId: characterId,
      requestId: requestId,
    );
    if (!context.mounted) return;
    if (request == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This owner request is no longer available.')),
      );
      return;
    }

    final action = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final trial = request.chargeMode == 'trial';
        final priceLabel =
            trial ? 'trial' : '${request.priceCredits} Credits';
        return AlertDialog(
          title: const Text('Talk-to-owner request'),
          content: Text(
            '${request.durationMinutes} minutes · $priceLabel\n'
            '${_stateLabel(request.state)}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
            if (request.state == OwnerAccessState.requested)
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop('decline'),
                child: const Text('Decline'),
              ),
            if (request.state == OwnerAccessState.requested)
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop('accept'),
                child: const Text('Accept'),
              ),
            if (request.state == OwnerAccessState.accepted)
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop('schedule'),
                child: const Text('Schedule'),
              ),
            if (request.state == OwnerAccessState.accepted ||
                request.state == OwnerAccessState.scheduled)
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop('start'),
                child: const Text('Start now'),
              ),
            if (request.state == OwnerAccessState.active)
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop('open'),
                child: const Text('Open human chat'),
              ),
          ],
        );
      },
    );
    if (action == null || !context.mounted) return;

    if (action == 'open') {
      context.push(
        '/owner-session/' +
            Uri.encodeComponent(characterId) +
            '/' +
            Uri.encodeComponent(requestId),
      );
      return;
    }

    DateTime? scheduledFor;
    if (action == 'schedule') {
      scheduledFor = await _pickSchedule(context);
      if (scheduledFor == null || !context.mounted) return;
    }

    final updated = await controller.act(
      characterId: characterId,
      requestId: requestId,
      action: action,
      scheduledFor: scheduledFor,
    );
    if (!context.mounted) return;
    await ref.read(twinActivityProvider.notifier).refresh();
    if (!context.mounted) return;
    if (action == 'start' && updated?.state == OwnerAccessState.active) {
      await context.push(
        '/owner-session/' +
            Uri.encodeComponent(characterId) +
            '/' +
            Uri.encodeComponent(requestId),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          updated == null
              ? 'Could not update the request.'
              : 'Request updated: ${_stateLabel(updated.state)}.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final activity = ref.watch(twinActivityProvider);
    final chat = ref.watch(aiChatProvider);
    final directory = ref.watch(agentDirectoryProvider);

    String nameFor(String characterId, String? title) {
      final custom = title?.trim();
      if (custom != null && custom.isNotEmpty) return custom;
      final agent = directory.find(characterId);
      return agent?.displayName ?? 'Conversation';
    }

    Future<void> refreshAll() async {
      await Future.wait<void>([
        ref.read(twinActivityProvider.notifier).refresh().catchError((_) {}),
        ref.read(agentDirectoryProvider.notifier).refresh().catchError((_) {}),
      ]);
    }

    final threads = chat.chatList;

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: const AppBar(title: Text('Activity')),
      body: RefreshIndicator(
        onRefresh: refreshAll,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 28),
          children: [
            if (threads.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 36, 20, 28),
                child: Text(
                  'Your conversations will appear here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted, fontSize: 14),
                ),
              )
            else
              for (final thread in threads)
                _ConversationTile(
                  name: nameFor(thread.characterId, thread.title),
                  preview: thread.lastMessage?.text ?? '',
                  updatedAt: thread.updatedAt,
                  unread: thread.unread,
                  onTap: () => context.push(
                    '/chat/' + Uri.encodeComponent(thread.characterId),
                  ),
                ),
            activity.when(
              loading: () => threads.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (view) {
                if (view == null || !view.hasTwin) {
                  return const SizedBox.shrink();
                }
                final characterId = view.characterId;
                final pendingOwnerRequest = _firstPendingOwnerRequest(view.items);
                return Column(
                  children: [
                    const Divider(height: 16),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                      child: _Summary(summary: view.summary),
                    ),
                    if (view.summary.pendingOwnerRequests > 0)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                        child: _NeedsYou(
                          count: view.summary.pendingOwnerRequests,
                          onTap: characterId != null && pendingOwnerRequest != null
                              ? () => _manageOwnerRequest(
                                  context,
                                  ref,
                                  characterId: characterId,
                                  item: pendingOwnerRequest,
                                )
                              : null,
                        ),
                      ),
                    for (final item in view.items)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: _ActivityTile(
                          item: item,
                          onTap: characterId != null &&
                                  item.kind == TwinActivityKind.ownerRequest &&
                                  item.referenceId != null
                              ? () => _manageOwnerRequest(
                                  context,
                                  ref,
                                  characterId: characterId,
                                  item: item,
                                )
                              : null,
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.name,
    required this.preview,
    required this.updatedAt,
    required this.unread,
    required this.onTap,
  });

  final String name;
  final String preview;
  final DateTime updatedAt;
  final int unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final local = updatedAt.toLocal();
    final time = local.hour.toString().padLeft(2, '0') + ':' +
        local.minute.toString().padLeft(2, '0');
    return Material(
      color: u.surfaceCard,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: u.structuralBorder, width: .7),
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: u.brandStrong,
                child: Text(
                  name.isEmpty ? 'M' : name.substring(0, 1).toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 15.5,
                        fontWeight: unread > 0
                            ? FontWeight.w700
                            : FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      preview.trim().isEmpty ? 'Open conversation' : preview,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: u.textMuted, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                children: [
                  Text(
                    time,
                    style: TextStyle(
                      color: unread > 0 ? u.brandStrong : u.textMuted,
                      fontSize: 11,
                    ),
                  ),
                  if (unread > 0) ...[
                    const SizedBox(height: 5),
                    Container(
                      constraints: const BoxConstraints(minWidth: 20),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: u.brand,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        unread > 99 ? '99+' : unread.toString(),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.summary});

  final TwinActivitySummary summary;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: u.structuralBorder),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth < 360 ? 2 : 3;
          final width =
              (constraints.maxWidth - ((columns - 1) * 12)) / columns;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: width,
                child: _Metric(
                  label: 'Visitors',
                  value: '${summary.visitors}',
                ),
              ),
              SizedBox(
                width: width,
                child: _Metric(
                  label: 'Chats',
                  value: '${summary.conversations}',
                ),
              ),
              SizedBox(
                width: width,
                child: _Metric(
                  label: 'Earned',
                  value: '${summary.earningsCredits} Cr',
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: TextStyle(color: u.textPrimary, fontSize: 17, fontWeight: FontWeight.w600)),
        const SizedBox(height: 3),
        Text(label, style: TextStyle(color: u.textMuted, fontSize: 12)),
      ],
    );
  }
}

class _NeedsYou extends StatelessWidget {
  const _NeedsYou({required this.count, this.onTap});
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            children: [
              Icon(Icons.person_add_alt_1_outlined, color: u.brand),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  count == 1
                      ? '1 person wants to talk to you.'
                      : '$count people want to talk to you.',
                  style: TextStyle(color: u.textPrimary, fontSize: 14),
                ),
              ),
              if (onTap != null) Icon(Icons.chevron_right, color: u.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item, this.onTap});
  final TwinActivityItem item;
  final VoidCallback? onTap;

  IconData get icon {
    switch (item.kind) {
      case TwinActivityKind.visit: return Icons.visibility_outlined;
      case TwinActivityKind.conversation: return Icons.chat_bubble_outline;
      case TwinActivityKind.purchase: return Icons.shopping_bag_outlined;
      case TwinActivityKind.gift: return Icons.card_giftcard_outlined;
      case TwinActivityKind.voice: return Icons.graphic_eq;
      case TwinActivityKind.ownerRequest: return Icons.person_outline;
      case TwinActivityKind.earning: return Icons.savings_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final amount = item.amountCredits;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: u.structuralBorder),
      ),
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: u.brand.withValues(alpha: 0.10),
          child: Icon(icon, color: u.brand, size: 20),
        ),
        title: Text(
          item.title,
          style: TextStyle(color: u.textPrimary, fontSize: 14, fontWeight: FontWeight.w500),
        ),
        subtitle: Text(
          item.detail,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: u.textMuted, fontSize: 12),
        ),
        trailing: amount == null
            ? (onTap == null ? null : Icon(Icons.chevron_right, color: u.textMuted))
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$amount Cr',
                    style: TextStyle(
                      color: u.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (onTap != null) ...[
                    const SizedBox(width: 4),
                    Icon(Icons.chevron_right, color: u.textMuted),
                  ],
                ],
              ),
      ),
    );
  }
}

class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * .55,
          child: Center(child: child),
        ),
      ],
    );
  }
}
