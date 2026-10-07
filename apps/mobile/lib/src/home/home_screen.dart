import 'package:flutter/material.dart';

import '../theme/masanawa_theme.dart';
import 'home_models.dart';

typedef HomeAssistantActionCallback = void Function(
  HomeAssistantCardModel assistant,
  HomeAssistantAction action,
);
typedef HomeQuickServiceCallback = void Function(HomeQuickService service);
typedef HomeRoomCallback = void Function(HomeRoomCardModel room);
typedef HomeContinuationCallback = void Function(HomeContinuationModel item);

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.state,
    this.onRetry,
    this.onRefresh,
    this.onAssistantAction,
    this.onQuickService,
    this.onOpenRoom,
    this.onOpenMyTwin,
    this.onCreateMyTwin,
    this.onOpenContinuation,
    this.onOpenProfile,
  });

  final HomeViewState state;
  final VoidCallback? onRetry;
  final Future<void> Function()? onRefresh;
  final HomeAssistantActionCallback? onAssistantAction;
  final HomeQuickServiceCallback? onQuickService;
  final HomeRoomCallback? onOpenRoom;
  final VoidCallback? onOpenMyTwin;
  final VoidCallback? onCreateMyTwin;
  final HomeContinuationCallback? onOpenContinuation;
  final VoidCallback? onOpenProfile;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      key: const ValueKey('home-screen'),
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Masanawa'),
        actions: [
          IconButton(
            tooltip: 'Profile',
            onPressed: onOpenProfile,
            icon: const Icon(Icons.account_circle_outlined),
          ),
        ],
      ),
      body: switch (state.status) {
        HomeLoadStatus.loading => const _HomeLoading(),
        HomeLoadStatus.error => _HomeError(
            message: state.errorMessage,
            onRetry: onRetry,
          ),
        HomeLoadStatus.ready => _HomeReady(
            snapshot: state.snapshot!,
            onRefresh: onRefresh,
            onAssistantAction: onAssistantAction,
            onQuickService: onQuickService,
            onOpenRoom: onOpenRoom,
            onOpenMyTwin: onOpenMyTwin,
            onCreateMyTwin: onCreateMyTwin,
            onOpenContinuation: onOpenContinuation,
          ),
      },
    );
  }
}

class _HomeReady extends StatelessWidget {
  const _HomeReady({
    required this.snapshot,
    required this.onRefresh,
    required this.onAssistantAction,
    required this.onQuickService,
    required this.onOpenRoom,
    required this.onOpenMyTwin,
    required this.onCreateMyTwin,
    required this.onOpenContinuation,
  });

  final HomeSnapshot snapshot;
  final Future<void> Function()? onRefresh;
  final HomeAssistantActionCallback? onAssistantAction;
  final HomeQuickServiceCallback? onQuickService;
  final HomeRoomCallback? onOpenRoom;
  final VoidCallback? onOpenMyTwin;
  final VoidCallback? onCreateMyTwin;
  final HomeContinuationCallback? onOpenContinuation;

  @override
  Widget build(BuildContext context) {
    if (!snapshot.hasMeaningfulContent) {
      return const _HomeEmpty();
    }

    final gwana = snapshot.assistantFor(HomeAssistantRole.gwana);
    final gwani = snapshot.assistantFor(HomeAssistantRole.gwani);

    final list = ListView(
      key: const ValueKey('home-content'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _AssistantCard(
                role: HomeAssistantRole.gwana,
                assistant: gwana,
                onAction: onAssistantAction,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _AssistantCard(
                role: HomeAssistantRole.gwani,
                assistant: gwani,
                onAction: onAssistantAction,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _QuickServices(onTap: onQuickService),
        if (snapshot.myTwin case final twin?) ...[
          const SizedBox(height: 22),
          _TwinCard(
            model: twin,
            onOpen: twin.hasTwin ? onOpenMyTwin : onCreateMyTwin,
          ),
        ],
        if (snapshot.continuations.isNotEmpty) ...[
          const SizedBox(height: 14),
          ...snapshot.continuations.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _ContinuationCard(
                item: item,
                onTap: onOpenContinuation == null
                    ? null
                    : () => onOpenContinuation!(item),
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        for (final room in _orderedRooms(snapshot.rooms)) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _RoomCard(
              room: room,
              displayTitle: _roomDisplayTitle(room),
              onTap: onOpenRoom == null ? null : () => onOpenRoom!(room),
            ),
          ),
          if (room.iconKey == 'internet_cafe')
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _CryptoTokensCard(
                onTap: onQuickService == null
                    ? null
                    : () => onQuickService!(HomeQuickService.crypto),
              ),
            ),
        ],
      ],
    );
    return onRefresh == null
        ? list
        : RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}

class _AssistantCard extends StatelessWidget {
  const _AssistantCard({
    required this.role,
    required this.assistant,
    required this.onAction,
  });

  final HomeAssistantRole role;
  final HomeAssistantCardModel? assistant;
  final HomeAssistantActionCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final fallbackName = role == HomeAssistantRole.gwana ? 'Gwana' : 'Gwani';
    final model = assistant;
    final available = model?.isAvailable == true;

    return Container(
      key: ValueKey('home-assistant-' + role.name),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: u.brand.withValues(alpha: .12),
            child: Text(
              model?.initials ?? fallbackName.substring(0, 1),
              style: TextStyle(
                color: u.brand,
                fontSize: 19,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            model?.displayName ?? fallbackName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: u.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (available && model!.voiceLabel?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 5),
            Text(
              model.voiceLabel!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: u.textMuted, fontSize: 11),
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 4,
            runSpacing: 4,
            children: [
              _AssistantAction(
                tooltip: 'Chat',
                icon: Icons.chat_bubble_outline,
                enabled: available,
                onTap: model == null || onAction == null
                    ? null
                    : () => onAction!(model, HomeAssistantAction.chat),
              ),
              _AssistantAction(
                tooltip: 'Talk',
                icon: Icons.mic_none_rounded,
                enabled: available,
                onTap: model == null || onAction == null
                    ? null
                    : () => onAction!(model, HomeAssistantAction.talk),
              ),
              _AssistantAction(
                tooltip: 'Live voice',
                icon: Icons.call_outlined,
                enabled: available,
                onTap: model == null || onAction == null
                    ? null
                    : () => onAction!(model, HomeAssistantAction.liveVoice),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AssistantAction extends StatelessWidget {
  const _AssistantAction({
    required this.tooltip,
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final String tooltip;
  final IconData icon;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return IconButton(
      tooltip: tooltip,
      visualDensity: VisualDensity.compact,
      onPressed: enabled ? onTap : null,
      style: IconButton.styleFrom(
        backgroundColor: u.surfaceMuted,
        foregroundColor: u.brand,
      ),
      icon: Icon(icon, size: 19),
    );
  }
}

class _QuickServices extends StatelessWidget {
  const _QuickServices({required this.onTap});

  final HomeQuickServiceCallback? onTap;

  static const _items = <(HomeQuickService, String, IconData)>[
    (HomeQuickService.data, 'Data', Icons.signal_cellular_alt),
    (HomeQuickService.airtime, 'Airtime', Icons.phone_android_outlined),
    (HomeQuickService.electricity, 'Electricity', Icons.bolt_outlined),
    (HomeQuickService.tv, 'TV', Icons.tv_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final item in _items) ...[
            _QuickServiceButton(
              service: item.$1,
              label: item.$2,
              icon: item.$3,
              onTap: onTap == null ? null : () => onTap!(item.$1),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _QuickServiceButton extends StatelessWidget {
  const _QuickServiceButton({
    required this.service,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final HomeQuickService service;
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceMuted,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        key: ValueKey('home-quick-' + service.name),
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: u.brand, size: 17),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CryptoTokensCard extends StatelessWidget {
  const _CryptoTokensCard({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: ListTile(
        key: const ValueKey('home-room-crypto-tokens'),
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: u.surfaceMuted,
          child: Icon(Icons.currency_bitcoin, color: u.brand),
        ),
        title: const Text('Crypto Tokens'),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _TwinCard extends StatelessWidget {
  const _TwinCard({required this.model, required this.onOpen});

  final HomeTwinCardModel model;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: ListTile(
        key: const ValueKey('home-my-twin'),
        onTap: onOpen,
        leading: CircleAvatar(
          backgroundColor: u.brand.withValues(alpha: .12),
          child: Icon(Icons.auto_awesome_outlined, color: u.brand),
        ),
        title: Text(model.title),
        subtitle: Text(model.subtitle),
        trailing: Icon(
          model.hasTwin ? Icons.chevron_right : Icons.add_circle_outline,
          color: u.brand,
        ),
      ),
    );
  }
}

class _ContinuationCard extends StatelessWidget {
  const _ContinuationCard({required this.item, required this.onTap});

  final HomeContinuationModel item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: ListTile(
        key: ValueKey('home-continuation-' + item.id),
        onTap: onTap,
        leading: Icon(Icons.play_circle_outline, color: u.brand),
        title: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          item.subtitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

String _roomDisplayTitle(HomeRoomCardModel room) => switch (room.iconKey) {
      'story_radio' => 'Audio Stories',
      'news' => 'News Updates',
      _ => room.title,
    };

List<HomeRoomCardModel> _orderedRooms(List<HomeRoomCardModel> rooms) {
  const order = ['story_radio', 'news'];
  int rank(HomeRoomCardModel room) {
    final index = order.indexOf(room.iconKey);
    return index == -1 ? order.length : index;
  }
  final sorted = [...rooms];
  sorted.sort((a, b) => rank(a).compareTo(rank(b)));
  return sorted;
}

class _RoomCard extends StatelessWidget {
  const _RoomCard({required this.room, required this.onTap});

  final HomeRoomCardModel room;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final enabled = room.isAvailable && onTap != null;
    return Material(
      color: u.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: ListTile(
        key: ValueKey('home-room-' + room.roomId),
        enabled: room.isAvailable,
        onTap: enabled ? onTap : null,
        leading: CircleAvatar(
          backgroundColor: u.surfaceMuted,
          child: Icon(_roomIcon(room.iconKey), color: u.brand),
        ),
        title: Text(displayTitle),
        subtitle: Text(
          room.continuationLabel?.trim().isNotEmpty == true
              ? room.continuationLabel!
              : room.description,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: room.isAvailable
            ? const Icon(Icons.chevron_right)
            : Text('Soon', style: TextStyle(color: u.textMuted, fontSize: 12)),
      ),
    );
  }

  IconData _roomIcon(String key) => switch (key) {
        'internet_cafe' => Icons.language_outlined,
        'study' => Icons.school_outlined,
        'story_radio' => Icons.headphones_outlined,
        'work' => Icons.work_outline,
        'research' => Icons.travel_explore_outlined,
        'news' => Icons.newspaper_outlined,
        'groups' => Icons.groups_outlined,
        _ => Icons.grid_view_outlined,
      };
}

class _HomeLoading extends StatelessWidget {
  const _HomeLoading();

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      key: const ValueKey('home-loading'),
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          height: 210,
          decoration: BoxDecoration(
            color: u.surfaceMuted,
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        const SizedBox(height: 14),
        LinearProgressIndicator(
          minHeight: 3,
          borderRadius: BorderRadius.circular(99),
        ),
      ],
    );
  }
}

class _HomeError extends StatelessWidget {
  const _HomeError({required this.message, required this.onRetry});

  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return _CenteredState(
      key: const ValueKey('home-error'),
      icon: Icons.cloud_off_outlined,
      title: 'Home could not load',
      message: message?.trim().isNotEmpty == true
          ? message!
          : 'Check your connection and try again.',
      actionLabel: 'Try again',
      onAction: onRetry,
    );
  }
}

class _HomeEmpty extends StatelessWidget {
  const _HomeEmpty();

  @override
  Widget build(BuildContext context) {
    return const _CenteredState(
      key: ValueKey('home-empty'),
      icon: Icons.home_outlined,
      title: 'Nothing to show yet',
      message: 'Your assistants and Rooms will appear here when available.',
      actionLabel: 'Refresh',
      onAction: null,
    );
  }
}

class _CenteredState extends StatelessWidget {
  const _CenteredState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(28),
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * .12),
        Icon(icon, size: 42, color: u.brand),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, height: 1.4),
        ),
        if (onAction != null) ...[
          const SizedBox(height: 18),
          Center(
            child: FilledButton(
              onPressed: onAction,
              child: Text(actionLabel),
            ),
          ),
        ],
      ],
    );
  }
}
