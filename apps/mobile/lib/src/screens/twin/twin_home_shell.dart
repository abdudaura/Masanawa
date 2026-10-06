import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../agents/twin_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/agent_directory_state.dart';
import '../activity/activity_screen.dart';
import '../explore/explore_screen.dart';
import '../wallet/wallet_screen.dart';
import 'my_twin_screen.dart';
import 'twin_share_sheet.dart';

/// Consumer-facing Masanawa root.
///
/// Runtime details such as Characters, Skills, Agent Float and providers stay behind
/// this shell. The ordinary user navigates My Twin, Explore, Activity and Wallet.
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

  void _openOwnedTwin(String characterId) {
    context.push('/chat/${Uri.encodeComponent(characterId)}');
  }

  void _teachOwnedTwin(String characterId) {
    context.push('/chat/${Uri.encodeComponent(characterId)}?entry=teach');
  }

  AgentDirectoryEntry? _supportAgent() {
    final agents = ref.read(agentDirectoryProvider).agents;
    for (final agent in agents) {
      if (agent.defaultPlatformAgent) return agent;
    }
    for (final agent in agents) {
      if (agent.supportAgent) return agent;
    }
    for (final agent in agents) {
      if (agent.displayName.trim().toLowerCase() == 'gwani') return agent;
    }
    return null;
  }

  Future<void> _openInternetCafe() async {
    var agent = _supportAgent();
    if (agent == null) {
      await ref.read(agentDirectoryProvider.notifier).refresh();
      if (!mounted) return;
      agent = _supportAgent();
    }
    if (agent == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gwani isn’t available right now.')),
      );
      return;
    }
    context.push(
      '/chat/${Uri.encodeComponent(agent.characterId)}?entry=cafe',
    );
  }

  Future<void> _shareTwin(TwinProfile profile) async {
    final url = profile.publicUrl;
    if (url == null || url.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: false,
      builder: (sheetContext) => TwinShareSheet(
        displayName: profile.displayName,
        publicUrl: url,
        onShare: (value) async {
          await SharePlus.instance.share(
            ShareParams(
              text: 'Talk to ${profile.displayName} on Masanawa: $value',
            ),
          );
        },
      ),
    );
  }

  Future<void> _openServiceChat([String? prompt]) async {
    var agent = _supportAgent();
    if (agent == null) {
      await ref.read(agentDirectoryProvider.notifier).refresh();
      if (!mounted) return;
      agent = _supportAgent();
    }
    if (agent == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gwani isn’t available right now.')),
      );
      return;
    }
    final encodedPrompt = prompt == null || prompt.trim().isEmpty
        ? ''
        : '&prompt=${Uri.encodeQueryComponent(prompt.trim())}';
    context.push(
      '/chat/${Uri.encodeComponent(agent.characterId)}?entry=cafe$encodedPrompt',
    );
  }

  Widget _page(int index) {
    return switch (index) {
      0 => MyTwinScreen(
          onCreateTwin: () => context.push('/clone'),
          onTalkToTwin: _openOwnedTwin,
          onTeachTwin: _teachOwnedTwin,
          onShareTwin: _shareTwin,
          onOpenSettings: () => context.push('/settings'),
        ),
      1 => ExploreScreen(
          onOpenTwin: _openTwin,
          onOpenInternetCafe: () => unawaited(_openInternetCafe()),
        ),
      2 => const ActivityScreen(),
      3 => WalletScreen(
          onAddMoney: () => unawaited(_openServiceChat('Add money')),
          onSend: () => unawaited(_openServiceChat('Send Credits')),
          onWithdraw: () => unawaited(_openServiceChat('Withdraw money')),
          onBuyBills: () => unawaited(_openInternetCafe()),
          onOpenCrypto: () => unawaited(_openServiceChat('Help me with crypto')),
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
            icon: Icon(Icons.auto_awesome_outlined),
            selectedIcon: Icon(Icons.auto_awesome),
            label: 'My Twin',
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
