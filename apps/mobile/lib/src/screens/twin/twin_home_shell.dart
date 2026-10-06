import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../agents/agent_directory.dart';
import '../../agents/twin_directory.dart';
import '../../home/home_models.dart';
import '../../home/home_screen.dart';
import '../../state/agent_directory_state.dart';
import '../../state/my_twin_state.dart';
import '../../state/wallet_state.dart';
import '../activity/activity_screen.dart';
import '../explore/explore_screen.dart';
import '../wallet/send_credits_sheet.dart';
import '../wallet/wallet_screen.dart';

/// Consumer-facing Masanawa root.
///
/// Launch navigation is utility-first: Home, Explore, Activity and Wallet.
/// My Twin remains available from Home/profile instead of owning the first tab.
class TwinHomeShell extends ConsumerStatefulWidget {
  const TwinHomeShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  ConsumerState<TwinHomeShell> createState() => _TwinHomeShellState();
}

class _TwinHomeShellState extends ConsumerState<TwinHomeShell> {
  late int _index = widget.initialIndex.clamp(0, 3).toInt();

  void _openTwin(TwinDirectoryEntry twin) {
    ref.read(agentDirectoryProvider.notifier).primeTwin(twin);
    context.push('/chat/\${Uri.encodeComponent(twin.characterId)}');
  }

  Future<void> _sendCredits() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
        ),
        child: SendCreditsSheet(
          onSend: (recipient, amountCredits) async {
            final receipt = await ref
                .read(walletProvider.notifier)
                .sendCredits(
                  recipient: recipient,
                  amountCredits: amountCredits,
                );
            if (!sheetContext.mounted) return;
            if (receipt == null) {
              ScaffoldMessenger.of(sheetContext).showSnackBar(
                const SnackBar(
                  content: Text('Could not send Credits. Please try again.'),
                ),
              );
              return;
            }
            Navigator.of(sheetContext).pop();
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Credits sent.')),
            );
          },
        ),
      ),
    );
  }

  HomeViewState _homeState() {
    final directory = ref.watch(agentDirectoryProvider);
    final twin = ref.watch(myTwinProvider);

    if (directory.loading && directory.agents.isEmpty) {
      return const HomeViewState.loading();
    }
    if (directory.error != null && directory.agents.isEmpty) {
      return HomeViewState.error(directory.error);
    }

    final assistants = <HomeAssistantCardModel>[];
    for (final agent in directory.agents.where((entry) => entry.supportAgent)) {
      final name = agent.displayName.trim().toLowerCase();
      final role = switch (name) {
        'gwana' => HomeAssistantRole.gwana,
        'gwani' => HomeAssistantRole.gwani,
        _ => null,
      };
      if (role == null) continue;
      assistants.add(
        HomeAssistantCardModel(
          role: role,
          characterId: agent.characterId,
          displayName: agent.displayName,
          description: agent.about.isEmpty ? agent.roleLabel : agent.about,
          voiceLabel: agent.voiceName,
          avatarUrl: agent.avatarUrl,
          isAvailable: agent.presence != AgentPresence.offline,
        ),
      );
    }

    final profile = twin.asData?.value;
    final myTwin = profile == null
        ? const HomeTwinCardModel(
            title: 'My Twin',
            subtitle: 'Create your personal AI twin',
            hasTwin: false,
          )
        : HomeTwinCardModel(
            title: 'My Twin',
            subtitle: profile.hasTwin
                ? profile.displayName
                : 'Create your personal AI twin',
            hasTwin: profile.hasTwin,
            characterId: profile.characterId,
            publicUrl: profile.publicUrl,
          );

    return HomeViewState.ready(
      HomeSnapshot(
        assistants: List.unmodifiable(assistants),
        myTwin: myTwin,
        rooms: const [
          HomeRoomCardModel(
            roomId: 'internet-cafe',
            title: 'Internet Cafe',
            description: 'Data, airtime, electricity, TV and online services.',
            iconKey: 'internet_cafe',
            isAvailable: false,
          ),
          HomeRoomCardModel(
            roomId: 'study',
            title: 'Study Center',
            description: 'Learn, practice and continue lessons.',
            iconKey: 'study',
            isAvailable: false,
          ),
          HomeRoomCardModel(
            roomId: 'story-radio',
            title: 'Story Radio',
            description: 'Listen to serialized AI audio stories.',
            iconKey: 'story_radio',
            isAvailable: false,
          ),
          HomeRoomCardModel(
            roomId: 'work',
            title: 'Work & Business',
            description: 'Business plans, proposals, reports and projects.',
            iconKey: 'work',
            isAvailable: false,
          ),
          HomeRoomCardModel(
            roomId: 'research',
            title: 'Research & Answers',
            description: 'Research topics and compare sourced information.',
            iconKey: 'research',
            isAvailable: false,
          ),
          HomeRoomCardModel(
            roomId: 'news',
            title: 'News',
            description: 'Read current stories with visible sources.',
            iconKey: 'news',
            isAvailable: true,
          ),
          HomeRoomCardModel(
            roomId: 'groups',
            title: 'Group Rooms',
            description: 'Shared Rooms with people and AI participants.',
            iconKey: 'groups',
            isAvailable: false,
          ),
        ],
      ),
    );
  }

  void _openRoom(HomeRoomCardModel room) {
    if (room.roomId == 'news') {
      context.push('/news');
    }
  }

  void _assistantAction(
    HomeAssistantCardModel assistant,
    HomeAssistantAction action,
  ) {
    // Chat is the universal entry surface; voice-note/live-voice controls remain
    // available inside the same canonical conversation screen.
    context.push('/chat/\${Uri.encodeComponent(assistant.characterId)}');
  }

  void _quickService(HomeQuickService service) {
    // Until Internet Cafe composition lands, reuse the canonical billing screen
    // rather than inventing a Room-specific financial flow.
    context.push('/billing');
  }

  Widget _page(int index) {
    return switch (index) {
      0 => HomeScreen(
          state: _homeState(),
          onRetry: () => ref.read(agentDirectoryProvider.notifier).refresh(),
          onAssistantAction: _assistantAction,
          onQuickService: _quickService,
          onOpenRoom: _openRoom,
          onOpenMyTwin: () => context.push('/my-twin'),
          onCreateMyTwin: () => context.push('/clone'),
          onOpenProfile: () => context.push('/settings'),
        ),
      1 => ExploreScreen(onOpenTwin: _openTwin),
      2 => const ActivityScreen(),
      3 => WalletScreen(
          onSend: _sendCredits,
          onWithdraw: () => context.push('/crypto'),
          onBuyBills: () => context.push('/billing'),
          onOpenCrypto: () => context.push('/crypto'),
        ),
      _ => const SizedBox.shrink(),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: List.generate(4, _page),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
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
