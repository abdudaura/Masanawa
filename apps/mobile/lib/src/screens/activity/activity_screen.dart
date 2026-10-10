import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../activity/talk_activity.dart';
import '../../state/talk_activity_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({
    super.key,
    this.onOpenTalk,
    this.onOpenProfile,
    this.onOpenTransaction,
  });

  final void Function(String talkId)? onOpenTalk;
  final void Function(String profilePublicId)? onOpenProfile;
  final void Function(String transactionId)? onOpenTransaction;

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  TalkActivityFilter _filter = TalkActivityFilter.all;
  String? _busyInvitationId;
  int _actionEpoch = 0;

  String? _userId(SessionState? session) =>
      session is SessionSignedIn ? session.user.id : null;

  Future<void> _respondToInvitation(
    TalkActivityItem item, {
    required bool accept,
  }) async {
    final talkId = item.talkId?.trim();
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn ||
        _busyInvitationId != null ||
        talkId == null ||
        talkId.isEmpty) {
      return;
    }
    final actorUserId = session.user.id;
    final epoch = ++_actionEpoch;
    bool isCurrentActor() =>
        mounted &&
        _actionEpoch == epoch &&
        _userId(ref.read(sessionProvider)) == actorUserId;
    setState(() => _busyInvitationId = item.id);
    try {
      // A timeout after sending a response is not proof that the server
      // rejected it. Refresh authoritative activity before allowing a retry.
      try {
        await ref
            .read(talkActivityTransportProvider)
            .respondToInvitation(talkId: talkId, accept: accept);
      } catch (_) {
        if (!isCurrentActor()) return;
        _invalidateInvitationFilters();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Could not confirm the response. Refresh Activity before trying again.',
            ),
          ),
        );
        return;
      }

      if (!isCurrentActor()) return;
      // A successful mutation stays successful even if the following list
      // read fails. The provider owns the retryable read error state.
      _invalidateInvitationFilters();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept ? 'Invitation accepted.' : 'Invitation declined.',
          ),
        ),
      );
    } finally {
      if (isCurrentActor()) {
        setState(() => _busyInvitationId = null);
      }
    }
  }

  void _invalidateInvitationFilters() {
    // Invitations are projected into All and Talks, irrespective of the
    // currently selected filter when the mutation finishes.
    ref.invalidate(talkActivityProvider(TalkActivityFilter.all));
    ref.invalidate(talkActivityProvider(TalkActivityFilter.talks));
  }

  Future<void> _refresh() async {
    final filter = _filter;
    ref.invalidate(talkActivityProvider(filter));
    try {
      await ref.read(talkActivityProvider(filter).future);
    } catch (_) {
      // Keep the retryable, redacted error within the watched provider.
      // RefreshIndicator and retry-button callbacks must not leak a Future
      // exception or expose a raw transport error to the customer.
    }
  }

  void _open(TalkActivityItem item) {
    final talkId = item.talkId;
    if (talkId != null && talkId.isNotEmpty && widget.onOpenTalk != null) {
      widget.onOpenTalk!(talkId);
      return;
    }

    final profileId = item.profilePublicId;
    if (profileId != null &&
        profileId.isNotEmpty &&
        widget.onOpenProfile != null) {
      widget.onOpenProfile!(profileId);
      return;
    }

    final transactionId = item.transactionId;
    if (transactionId != null &&
        transactionId.isNotEmpty &&
        widget.onOpenTransaction != null) {
      widget.onOpenTransaction!(transactionId);
    }
  }

  bool _canOpen(TalkActivityItem item) {
    if (item.talkId?.isNotEmpty == true && widget.onOpenTalk != null) {
      return true;
    }
    if (item.profilePublicId?.isNotEmpty == true &&
        widget.onOpenProfile != null) {
      return true;
    }
    if (item.transactionId?.isNotEmpty == true &&
        widget.onOpenTransaction != null) {
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<SessionState>(sessionProvider, (previous, next) {
      if (_userId(previous) != _userId(next)) {
        // Any in-flight action belongs to the prior principal. Do not let its
        // eventual completion re-enable or mutate the next account's UI.
        _actionEpoch++;
        if (mounted) setState(() => _busyInvitationId = null);
      }
    });
    final session = ref.watch(sessionProvider);
    final u = context.masanawa;
    final activity = ref.watch(talkActivityProvider(_filter));

    return Scaffold(
      key: const ValueKey('talk-activity-screen'),
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Activity')),
      body: Column(
        children: [
          _ActivityFilters(
            selected: _filter,
            onSelected: (value) {
              if (value == _filter) return;
              setState(() => _filter = value);
            },
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: session is! SessionSignedIn
                  ? const _ActivityState(
                      icon: Icons.lock_outline_rounded,
                      title: 'Sign in to view Activity.',
                      subtitle: 'Your invitations and updates are private.',
                    )
                  : activity.when(
                loading: () => const _ActivityLoading(),
                error: (_, __) => _ActivityState(
                  icon: Icons.wifi_off_rounded,
                  title: 'Couldn’t refresh Activity.',
                  subtitle: 'Check your connection and try again.',
                  onRetry: _refresh,
                ),
                data: (items) {
                  if (items.isEmpty) {
                    return _ActivityState(
                      icon: _emptyIcon(_filter),
                      title: _emptyTitle(_filter),
                      subtitle: _emptySubtitle(_filter),
                    );
                  }

                  return ListView.separated(
                    key: ValueKey('activity-list-' + _filter.name),
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(bottom: 28),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => Divider(
                      height: 1,
                      indent: 68,
                      color: u.structuralBorder,
                    ),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      final actionableInvitation =
                          item.kind == TalkActivityKind.talkInvitation &&
                          item.requiresAction &&
                          item.talkId?.isNotEmpty == true;
                      return _ActivityItemTile(
                        key: ValueKey('activity-item-' + item.id),
                        item: item,
                        canOpen: _canOpen(item),
                        busy: _busyInvitationId == item.id,
                        onTap: _canOpen(item) ? () => _open(item) : null,
                        onAccept: actionableInvitation
                            ? () => _respondToInvitation(item, accept: true)
                            : null,
                        onDecline: actionableInvitation
                            ? () => _respondToInvitation(item, accept: false)
                            : null,
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityFilters extends StatelessWidget {
  const _ActivityFilters({required this.selected, required this.onSelected});

  final TalkActivityFilter selected;
  final ValueChanged<TalkActivityFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      width: double.infinity,
      color: u.surfaceCard,
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 9),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final filter in TalkActivityFilter.values) ...[
              ChoiceChip(
                key: ValueKey('activity-filter-' + filter.name),
                label: Text(_filterLabel(filter)),
                selected: selected == filter,
                onSelected: (_) => onSelected(filter),
              ),
              if (filter != TalkActivityFilter.values.last)
                const SizedBox(width: 7),
            ],
          ],
        ),
      ),
    );
  }
}

class _ActivityItemTile extends StatelessWidget {
  const _ActivityItemTile({
    super.key,
    required this.item,
    required this.canOpen,
    this.busy = false,
    this.onTap,
    this.onAccept,
    this.onDecline,
  });

  final TalkActivityItem item;
  final bool canOpen;
  final bool busy;
  final VoidCallback? onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final amount = item.amountLabel?.trim();
    final action = item.actionLabel?.trim();

    return Material(
      color: item.unread ? u.brand.withValues(alpha: .045) : u.surfaceCard,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 11, 10, 11),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: u.surfaceMuted,
                child: Icon(
                  _kindIcon(item.kind),
                  size: 21,
                  color: _kindColor(context, item.kind),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: u.textPrimary,
                              fontSize: 14.5,
                              height: 1.2,
                              fontWeight: item.unread
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                            ),
                          ),
                        ),
                        if (item.unread) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 7,
                            height: 7,
                            margin: const EdgeInsets.only(top: 5),
                            decoration: BoxDecoration(
                              color: u.brandStrong,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (item.detail.trim().isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        item.detail,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 12.5,
                          height: 1.3,
                        ),
                      ),
                    ],
                    if (onAccept != null && onDecline != null) ...[
                      const SizedBox(height: 9),
                      Row(
                        children: [
                          OutlinedButton(
                            key: ValueKey('activity-invite-decline-' + item.id),
                            onPressed: busy ? null : onDecline,
                            child: const Text('Decline'),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            key: ValueKey('activity-invite-accept-' + item.id),
                            onPressed: busy ? null : onAccept,
                            child: busy
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('Accept'),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          _timeLabel(item.createdAt),
                          style: TextStyle(color: u.textMuted, fontSize: 11),
                        ),
                        if (amount != null && amount.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(
                            amount,
                            style: TextStyle(
                              color: u.brandStrong,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                        if (item.requiresAction &&
                            action != null &&
                            action.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(
                            action,
                            style: TextStyle(
                              color: u.brandStrong,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (canOpen) ...[
                const SizedBox(width: 4),
                Icon(Icons.chevron_right_rounded, color: u.textMuted, size: 20),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ActivityLoading extends StatelessWidget {
  const _ActivityLoading();

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 28),
      children: [
        for (var i = 0; i < 5; i++) ...[
          Container(
            height: 72,
            decoration: BoxDecoration(
              color: u.surfaceMuted,
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _ActivityState extends StatelessWidget {
  const _ActivityState({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(28, 90, 28, 28),
      children: [
        Icon(icon, size: 42, color: u.textMuted),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, fontSize: 13, height: 1.35),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: 16),
          Center(
            child: OutlinedButton.icon(
              key: const ValueKey('activity-retry'),
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ),
        ],
      ],
    );
  }
}

String _filterLabel(TalkActivityFilter filter) => switch (filter) {
  TalkActivityFilter.all => 'All',
  TalkActivityFilter.talks => 'Talks',
  TalkActivityFilter.money => 'Money',
  TalkActivityFilter.social => 'Social',
};

IconData _kindIcon(TalkActivityKind kind) => switch (kind) {
  TalkActivityKind.talkInvitation => Icons.podcasts_rounded,
  TalkActivityKind.raiseHandAccepted => Icons.back_hand_rounded,
  TalkActivityKind.raiseHandDeclined => Icons.back_hand_outlined,
  TalkActivityKind.aiSeatSponsored => Icons.person_add_alt_1_rounded,
  TalkActivityKind.aiSeatAccepted => Icons.verified_rounded,
  TalkActivityKind.aiSeatDeclined => Icons.person_off_outlined,
  TalkActivityKind.follow => Icons.person_add_alt_rounded,
  TalkActivityKind.gift => Icons.card_giftcard_rounded,
  TalkActivityKind.twinHired => Icons.auto_awesome_rounded,
  TalkActivityKind.earning => Icons.savings_outlined,
  TalkActivityKind.replayMilestone => Icons.play_circle_outline_rounded,
  TalkActivityKind.platform => Icons.notifications_none_rounded,
};

Color _kindColor(BuildContext context, TalkActivityKind kind) {
  final u = context.masanawa;
  return switch (kind) {
    TalkActivityKind.gift || TalkActivityKind.earning => u.success,
    TalkActivityKind.raiseHandDeclined ||
    TalkActivityKind.aiSeatDeclined => u.textMuted,
    _ => u.brandStrong,
  };
}

IconData _emptyIcon(TalkActivityFilter filter) => switch (filter) {
  TalkActivityFilter.all => Icons.notifications_none_rounded,
  TalkActivityFilter.talks => Icons.podcasts_outlined,
  TalkActivityFilter.money => Icons.savings_outlined,
  TalkActivityFilter.social => Icons.people_outline_rounded,
};

String _emptyTitle(TalkActivityFilter filter) => switch (filter) {
  TalkActivityFilter.all => 'Nothing here yet.',
  TalkActivityFilter.talks => 'No Talk activity yet.',
  TalkActivityFilter.money => 'No money activity yet.',
  TalkActivityFilter.social => 'No social activity yet.',
};

String _emptySubtitle(TalkActivityFilter filter) => switch (filter) {
  TalkActivityFilter.all =>
    'Invitations, follows, gifts and Talk updates will appear here.',
  TalkActivityFilter.talks =>
    'Talk invitations, Seat requests and replay updates will appear here.',
  TalkActivityFilter.money =>
    'Gifts, AI Seat revenue and creator earnings will appear here.',
  TalkActivityFilter.social =>
    'Follows and other social activity will appear here.',
};

String _timeLabel(DateTime value) {
  final local = value.toLocal();
  final now = DateTime.now();
  final difference = now.difference(local);

  if (difference.isNegative || difference.inMinutes < 1) return 'now';
  if (difference.inMinutes < 60) return difference.inMinutes.toString() + 'm';
  if (difference.inHours < 24) return difference.inHours.toString() + 'h';
  if (difference.inDays < 7) return difference.inDays.toString() + 'd';

  return local.day.toString().padLeft(2, '0') +
      '/' +
      local.month.toString().padLeft(2, '0');
}
