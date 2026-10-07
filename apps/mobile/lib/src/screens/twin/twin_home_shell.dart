import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../agents/agent_directory.dart';
import '../../agents/twin_directory.dart';
import '../../agents/twin_profile.dart';
import '../../home/home_models.dart';
import '../../home/home_screen.dart';
import '../../home/home_state.dart';
import '../../state/agent_directory_state.dart';
import '../../state/my_twin_state.dart';
import '../activity/activity_screen.dart';
import '../explore/explore_screen.dart';
import '../wallet/wallet_screen.dart';
import 'my_twin_screen.dart';
import 'twin_share_sheet.dart';

class TwinHomeShell extends ConsumerStatefulWidget {
  const TwinHomeShell({super.key, this.initialIndex = 0});
  final int initialIndex;

  @override
  ConsumerState<TwinHomeShell> createState() => _TwinHomeShellState();
}

class _TwinHomeShellState extends ConsumerState<TwinHomeShell> {
  late int _index;
  late final Set<int> _visitedTabs;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, 3).toInt();
    _visitedTabs = <int>{_index};
  }

  void _openTwin(TwinDirectoryEntry twin) {
    ref.read(agentDirectoryProvider.notifier).primeTwin(twin);
    context.push('/chat/${Uri.encodeComponent(twin.characterId)}');
  }

  AgentDirectoryEntry? _supportAgent() {
    final directory = ref.read(agentDirectoryProvider);
    for (final agent in directory.agents) {
      if (agent.defaultPlatformAgent) return agent;
    }
    for (final agent in directory.agents) {
      if (agent.supportAgent &&
          agent.displayName.trim().toLowerCase() == 'gwani') {
        return agent;
      }
    }
    for (final agent in directory.agents) {
      if (agent.supportAgent) return agent;
    }
    return null;
  }

  Future<AgentDirectoryEntry?> _ensureSupportAgent() async {
    var agent = _supportAgent();
    if (agent != null) return agent;
    await ref.read(agentDirectoryProvider.notifier).refresh();
    return _supportAgent();
  }

  Future<void> _openServiceChat({
    String? prompt,
    String? entry,
  }) async {
    final agent = await _ensureSupportAgent();
    if (!mounted) return;
    if (agent == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gwani is unavailable. Try again shortly.')),
      );
      return;
    }
    final params = <String, String>{};
    if (entry != null && entry.isNotEmpty) params['entry'] = entry;
    if (prompt != null && prompt.trim().isNotEmpty) params['prompt'] = prompt.trim();
    final query = params.isEmpty ? '' : '?${Uri(queryParameters: params).query}';
    context.push('/chat/${Uri.encodeComponent(agent.characterId)}$query');
  }

  void _assistantAction(
    HomeAssistantCardModel assistant,
    HomeAssistantAction action,
  ) {
    final entry = switch (action) {
      HomeAssistantAction.chat => null,
      HomeAssistantAction.talk => 'live-talk',
      HomeAssistantAction.liveVoice => 'live-voice',
    };
    final query = entry == null ? '' : '?entry=$entry';
    context.push('/chat/${Uri.encodeComponent(assistant.characterId)}$query');
  }

  void _quickService(HomeQuickService service) {
    switch (service) {
      case HomeQuickService.data:
        unawaited(_openServiceChat(prompt: 'I want to buy data.', entry: 'cafe'));
      case HomeQuickService.airtime:
        unawaited(_openServiceChat(prompt: 'I want to buy airtime.', entry: 'cafe'));
      case HomeQuickService.electricity:
        unawaited(_openServiceChat(
          prompt: 'I want to pay for electricity.',
          entry: 'cafe',
        ));
      case HomeQuickService.tv:
        unawaited(_openServiceChat(prompt: 'I want to pay for TV.', entry: 'cafe'));
      case HomeQuickService.crypto:
        unawaited(_openServiceChat(prompt: 'Help me with crypto.'));
    }
  }

  void _openRoom(HomeRoomCardModel room) {
    switch (room.iconKey) {
      case 'internet_cafe':
        unawaited(_openServiceChat(entry: 'cafe'));
      case 'study':
        unawaited(_openServiceChat(
          entry: 'study',
          prompt: 'I want to learn something. Help me start a lesson.',
        ));
      case 'story_radio':
        unawaited(_openServiceChat(prompt: 'Open Story Radio for me.'));
      case 'news':
        unawaited(_openServiceChat(prompt: 'Show me the latest news.'));
      default:
        unawaited(_openServiceChat(
          prompt: 'Open ${room.title} and help me with what I need there.',
        ));
    }
  }

  void _openContinuation(HomeContinuationModel item) {
    final characterId = item.characterId;
    if (characterId != null && characterId.isNotEmpty) {
      context.push('/chat/${Uri.encodeComponent(characterId)}');
      return;
    }
    final roomId = item.roomId;
    if (roomId != null && roomId.isNotEmpty) {
      unawaited(_openServiceChat(prompt: 'Continue my work in $roomId.'));
    }
  }

  Future<void> _openMyTwin() async {
    final twin = await ref.read(myTwinProvider.future);
    if (!mounted) return;
    if (twin == null || !twin.hasTwin) {
      context.push('/clone');
      return;
    }
    context.push('/my-twin');
  }

  Widget _home() {
    final asyncHome = ref.watch(homeProvider);
    final state = asyncHome.when(
      loading: () => const HomeViewState.loading(),
      error: (_, __) => const HomeViewState.error(),
      data: HomeViewState.ready,
    );
    return HomeScreen(
      state: state,
      onRetry: () {
        ref.invalidate(homeProvider);
        unawaited(ref.read(homeProvider.notifier).refresh());
      },
      onRefresh: () => ref.read(homeProvider.notifier).refresh(),
      onAssistantAction: _assistantAction,
      onQuickService: _quickService,
      onOpenRoom: _openRoom,
      onOpenMyTwin: _openMyTwin,
      onCreateMyTwin: () => context.push('/clone'),
      onOpenContinuation: _openContinuation,
      onOpenProfile: () => context.push('/settings'),
    );
  }

  Widget _page(int index) {
    return switch (index) {
      0 => _home(),
      1 => ExploreScreen(
          onOpenTwin: _openTwin,
          onOpenInternetCafe: () => unawaited(_openServiceChat(entry: 'cafe')),
        ),
      2 => const ActivityScreen(),
      3 => WalletScreen(
          onAddMoney: () => unawaited(_openServiceChat(prompt: 'Add money')),
          onSend: () => unawaited(_openServiceChat(prompt: 'Send Credits')),
          onWithdraw: () => unawaited(_openServiceChat(prompt: 'Withdraw money')),
          onBuyBills: () => unawaited(_openServiceChat(entry: 'cafe')),
          onOpenCrypto: () => unawaited(_openServiceChat(prompt: 'Help me with crypto')),
        ),
      _ => const SizedBox.shrink(),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: List.generate(
          4,
          (index) => _visitedTabs.contains(index)
              ? _page(index)
              : const SizedBox.shrink(),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) {
          setState(() {
            _index = value;
            _visitedTabs.add(value);
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Explore',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_none_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Activity',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Wallet',
          ),
        ],
      ),
    );
  }
}

class MyTwinRouteScreen extends ConsumerWidget {
  const MyTwinRouteScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void openChat(String characterId, {bool teach = false}) {
      final query = teach ? '?entry=teach' : '';
      context.push('/chat/${Uri.encodeComponent(characterId)}$query');
    }

    Future<void> share(TwinProfile profile) async {
      final url = profile.publicUrl;
      if (url == null || url.isEmpty) return;
      await SharePlus.instance.share(
        ShareParams(text: 'Talk to ${profile.displayName} on Masanawa: $url'),
      );
    }

    return MyTwinScreen(
      onCreateTwin: () => context.push('/clone'),
      onTalkToTwin: (id) => openChat(id),
      onTeachTwin: (id) => openChat(id, teach: true),
      onShareTwin: share,
      onOpenSettings: () => context.push('/settings'),
    );
  }
}
