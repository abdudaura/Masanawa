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
            tooltip: 'Profile and settings',
            onPressed: onOpenProfile,
            icon: const Icon(Icons.more_vert_rounded),
          ),
        ],
      ),
      body: switch (state.status) {
        HomeLoadStatus.loading => const _HomeLoading(),
        HomeLoadStatus.error => _HomeError(onRetry: onRetry),
        HomeLoadStatus.ready => _HomeReady(
            snapshot: state.snapshot!,
            onRefresh: onRefresh,
            onAssistantAction: onAssistantAction,
            onQuickService: onQuickService,
            onOpenRoom: onOpenRoom,
            onOpenMyTwin: onOpenMyTwin,
            onCreateMyTwin: onCreateMyTwin,
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
  });

  final HomeSnapshot snapshot;
  final Future<void> Function()? onRefresh;
  final HomeAssistantActionCallback? onAssistantAction;
  final HomeQuickServiceCallback? onQuickService;
  final HomeRoomCallback? onOpenRoom;
  final VoidCallback? onOpenMyTwin;
  final VoidCallback? onCreateMyTwin;

  @override
  Widget build(BuildContext context) {
    final gwani = snapshot.assistantFor(HomeAssistantRole.gwani);
    final gwana = snapshot.assistantFor(HomeAssistantRole.gwana);
    final rooms = _orderedRooms(snapshot.rooms)
        .where((room) => room.iconKey != 'groups')
        .toList(growable: false);

    final list = ListView(
      key: const ValueKey('home-content'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: _AssistantTile(
                  role: HomeAssistantRole.gwani,
                  assistant: gwani,
                  onAction: onAssistantAction,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _AssistantTile(
                  role: HomeAssistantRole.gwana,
                  assistant: gwana,
                  onAction: onAssistantAction,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 2),
        _QuickServices(onTap: onQuickService),
        if (snapshot.myTwin case final twin?) ...[
          const Divider(height: 10),
          _HomeRow(
            key: const ValueKey('home-my-twin'),
            icon: Icons.auto_awesome_rounded,
            title: twin.title,
            trailing: twin.hasTwin
                ? Icons.chevron_right_rounded
                : Icons.add_circle_outline_rounded,
            onTap: twin.hasTwin ? onOpenMyTwin : onCreateMyTwin,
          ),
        ],
        if (rooms.isNotEmpty) const Divider(height: 10),
        for (final room in rooms)
          _RoomRow(
            room: room,
            onTap: onOpenRoom == null ? null : () => onOpenRoom!(room),
          ),
        _HomeRow(
          key: const ValueKey('home-room-crypto-tokens'),
          icon: Icons.currency_bitcoin_rounded,
          title: 'Crypto',
          onTap: onQuickService == null
              ? null
              : () => onQuickService!(HomeQuickService.crypto),
        ),
      ],
    );

    return onRefresh == null
        ? list
        : RefreshIndicator(onRefresh: onRefresh!, child: list);
  }
}

class _AssistantTile extends StatelessWidget {
  const _AssistantTile({
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
    final fallback = role == HomeAssistantRole.gwani ? 'Gwani' : 'Gwana';
    final model = assistant;
    final available = model?.isAvailable == true;

    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        key: ValueKey('home-assistant-' + role.name),
        borderRadius: BorderRadius.circular(12),
        onTap: !available || model == null || onAction == null
            ? null
            : () => onAction!(model, HomeAssistantAction.chat),
        child: Container(
          height: 70,
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 17,
                backgroundColor: u.brandStrong,
                child: Text(
                  model?.initials ?? fallback.substring(0, 1),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      model?.displayName ?? fallback,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      available ? 'available' : 'offline',
                      style: TextStyle(
                        color: available ? u.brandStrong : u.textMuted,
                        fontSize: 10.5,
                      ),
                    ),
                  ],
                ),
              ),
              if (model != null && onAction != null)
                InkResponse(
                  radius: 19,
                  onTap: available
                      ? () => onAction!(model, HomeAssistantAction.liveVoice)
                      : null,
                  child: Padding(
                    padding: const EdgeInsets.all(5),
                    child: Icon(
                      Icons.call_rounded,
                      color: available ? u.brandStrong : u.textMuted,
                      size: 19,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickServices extends StatelessWidget {
  const _QuickServices({required this.onTap});
  final HomeQuickServiceCallback? onTap;

  static const _items = <(HomeQuickService, String, IconData)>[
    (HomeQuickService.data, 'Data', Icons.signal_cellular_alt_rounded),
    (HomeQuickService.airtime, 'Airtime', Icons.phone_android_rounded),
    (HomeQuickService.electricity, 'Power', Icons.bolt_rounded),
    (HomeQuickService.tv, 'TV', Icons.tv_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          for (final item in _items)
            Expanded(
              child: InkWell(
                key: ValueKey('home-quick-' + item.$1.name),
                borderRadius: BorderRadius.circular(10),
                onTap: onTap == null ? null : () => onTap!(item.$1),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(item.$3, color: u.brandStrong, size: 21),
                      const SizedBox(height: 3),
                      Text(
                        item.$2,
                        style: TextStyle(
                          color: u.textPrimary,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RoomRow extends StatelessWidget {
  const _RoomRow({required this.room, required this.onTap});
  final HomeRoomCardModel room;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final title = switch (room.iconKey) {
      'internet_cafe' => 'Internet Cafe',
      'study' => 'Study',
      'story_radio' => 'Audio Stories',
      'news' => 'News',
      'work' => 'Work & Business',
      'research' => 'Research',
      _ => room.title,
    };
    return _HomeRow(
      key: ValueKey('home-room-' + room.roomId),
      icon: _roomIcon(room.iconKey),
      title: title,
      enabled: room.isAvailable,
      onTap: room.isAvailable ? onTap : null,
      trailing: room.isAvailable ? Icons.chevron_right_rounded : null,
      status: room.isAvailable ? null : 'Soon',
    );
  }

  IconData _roomIcon(String key) => switch (key) {
        'internet_cafe' => Icons.language_rounded,
        'study' => Icons.school_rounded,
        'story_radio' => Icons.headphones_rounded,
        'work' => Icons.work_outline_rounded,
        'research' => Icons.travel_explore_rounded,
        'news' => Icons.newspaper_rounded,
        _ => Icons.grid_view_rounded,
      };
}

class _HomeRow extends StatelessWidget {
  const _HomeRow({
    super.key,
    required this.icon,
    required this.title,
    this.onTap,
    this.trailing = Icons.chevron_right_rounded,
    this.status,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final VoidCallback? onTap;
  final IconData? trailing;
  final String? status;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      child: InkWell(
        onTap: enabled ? onTap : null,
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: u.structuralBorder, width: .7),
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 17,
                backgroundColor: u.surfaceMuted,
                child: Icon(icon, size: 18, color: u.brandStrong),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: enabled ? u.textPrimary : u.textMuted,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (status != null)
                Text(status!, style: TextStyle(color: u.textMuted, fontSize: 11.5))
              else if (trailing != null)
                Icon(trailing, color: u.textMuted, size: 19),
            ],
          ),
        ),
      ),
    );
  }
}

List<HomeRoomCardModel> _orderedRooms(List<HomeRoomCardModel> rooms) {
  const order = [
    'internet_cafe',
    'study',
    'story_radio',
    'news',
    'work',
    'research',
    'groups',
  ];
  final sorted = [...rooms];
  sorted.sort((a, b) {
    final ai = order.indexOf(a.iconKey);
    final bi = order.indexOf(b.iconKey);
    return (ai < 0 ? 999 : ai).compareTo(bi < 0 ? 999 : bi);
  });
  return sorted;
}

class _HomeLoading extends StatelessWidget {
  const _HomeLoading();

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            for (var i = 0; i < 2; i++) ...[
              Expanded(
                child: Container(
                  height: 70,
                  decoration: BoxDecoration(
                    color: u.surfaceMuted,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              if (i == 0) const SizedBox(width: 8),
            ],
          ],
        ),
        const SizedBox(height: 18),
        const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

class _HomeError extends StatelessWidget {
  const _HomeError({required this.onRetry});
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(28),
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * .17),
        Icon(Icons.wifi_off_rounded, size: 42, color: u.textMuted),
        const SizedBox(height: 12),
        Text(
          'Couldn’t refresh Masanawa',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Check your connection and try again.',
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, fontSize: 14),
        ),
        const SizedBox(height: 18),
        Center(
          child: FilledButton(
            key: const ValueKey('home-retry'),
            onPressed: onRetry,
            child: const Text('Try again'),
          ),
        ),
      ],
    );
  }
}
