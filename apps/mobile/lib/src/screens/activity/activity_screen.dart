import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../agents/twin_activity.dart';
import '../../state/twin_activity_state.dart';
import '../../theme/masanawa_theme.dart';

class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final activity = ref.watch(twinActivityProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        title: Text(
          'Activity',
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(twinActivityProvider.notifier).refresh(),
        child: activity.when(
          loading: () => const _ScrollableCenter(
            child: CircularProgressIndicator(),
          ),
          error: (error, _) => _ScrollableCenter(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Activity is not available yet.',
                textAlign: TextAlign.center,
                style: TextStyle(color: u.textMuted),
              ),
            ),
          ),
          data: (view) {
            if (view == null || !view.hasTwin) {
              return _ScrollableCenter(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    'Create your twin to start seeing activity here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: u.textMuted),
                  ),
                ),
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                _Summary(summary: view.summary),
                const SizedBox(height: 18),
                if (view.summary.pendingOwnerRequests > 0) ...[
                  _NeedsYou(count: view.summary.pendingOwnerRequests),
                  const SizedBox(height: 18),
                ],
                Text(
                  'Recent',
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                if (view.items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    child: Text(
                      'Nothing yet. Share your twin and activity will appear here.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: u.textMuted),
                    ),
                  )
                else
                  ...view.items.map((item) => _ActivityTile(item: item)),
              ],
            );
          },
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
      child: Row(
        children: [
          Expanded(child: _Metric(label: 'Visitors', value: '${summary.visitors}')),
          Expanded(child: _Metric(label: 'Chats', value: '${summary.conversations}')),
          Expanded(
            child: _Metric(
              label: 'Earned',
              value: '${summary.earningsCredits} Cr',
            ),
          ),
        ],
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
  const _NeedsYou({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: u.surfaceCard,
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
          Icon(Icons.chevron_right, color: u.textMuted),
        ],
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item});
  final TwinActivityItem item;

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
            ? null
            : Text(
                '$amount Cr',
                style: TextStyle(color: u.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
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
