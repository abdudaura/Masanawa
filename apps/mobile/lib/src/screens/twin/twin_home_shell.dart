import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../agents/agent_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/agent_directory_state.dart';
import '../../talks/talk_models.dart';
import '../activity/activity_screen.dart';
import '../chat/ai_chat_screen.dart';
import '../talks/create_talk_screen.dart';
import '../talks/talk_home_screen.dart';
import '../wallet/wallet_screen.dart';
import '../you/you_screen.dart';
import 'my_twin_screen.dart';

/// Compatibility class name retained while the consumer shell is migrated.
///
/// Approved root shell: Home · Agents · Wallet · Talk.
/// Home owns the Explore / Live Talks tabs.
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

  Future<void> _openPrivateGwani() async {
    final agent = await _ensureSupportAgent();
    if (!mounted) return;
    if (agent == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gwani is unavailable. Try again shortly.')),
      );
      return;
    }
    context.push('/chat/' + Uri.encodeComponent(agent.characterId));
  }

  void _openTalk(TalkDiscoveryItem talk) {
    final hostQuery = talk.viewerIsHost ? '?host=1' : '';
    context.push(
      '/talk/' + Uri.encodeComponent(talk.id) + hostQuery,
      extra: talk,
    );
  }

  void _openCreatedTalk(TalkDiscoveryItem talk) {
    context.push(
      '/talk/' + Uri.encodeComponent(talk.id) + '?host=1',
      extra: talk,
    );
  }

  Widget _home() => TalkHomeScreen(
        onOpenTalk: _openTalk,
        onOpenSearch: () => context.push('/search'),
        onOpenGwani: _openPrivateGwani,
      );

  Widget _agents() {
    final directory = ref.watch(agentDirectoryProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Agents'),
          bottom: const TabBar(tabs: [
            Tab(text: 'Masanawa Agents'),
            Tab(text: 'Twins'),
          ]),
        ),
        body: TabBarView(children: [
          RefreshIndicator(
            onRefresh: () => ref.read(agentDirectoryProvider.notifier).refresh(),
            child: ListView(children: [
              if (directory.loading && directory.agents.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (directory.error != null)
                ListTile(
                  title: Text(directory.error!),
                  trailing: TextButton(
                    onPressed: () => ref.read(agentDirectoryProvider.notifier).refresh(),
                    child: const Text('Retry'),
                  ),
                ),
              for (final agent in directory.agents.where(
                  (agent) => !agent.roleLabel.toLowerCase().contains('twin')))
                ListTile(
                  leading: CircleAvatar(child: Text(agent.initial)),
                  title: Text(agent.displayName),
                  subtitle: Text(agent.roleLabel + ' · ' + agent.presenceLabel),
                  trailing: const Icon(Icons.chat_bubble_outline_rounded),
                  onTap: () => context.push(
                    '/chat/' + Uri.encodeComponent(agent.characterId)),
                ),
              if (!directory.loading && directory.agents.isEmpty)
                const ListTile(title: Text('No Masanawa Agents available yet.')),
            ]),
          ),
          const MyTwinRouteScreen(),
        ]),
      ),
    );
  }

  Widget _wallet() => WalletScreen(
        onBuyBills: () => context.push('/billing'),
        onOpenCrypto: () => context.push('/crypto'),
      );

  Widget _privateTalk() {
    final directory = ref.watch(agentDirectoryProvider);
    final agent = _supportAgent();
    if (agent != null) {
      // Private chat owns its own voice controls; tab selection never
      // grants microphone permission or broadcasts public Talk audio.
      return AiChatScreen(characterId: agent.characterId);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Talk')),
      body: Center(
        child: directory.loading
            ? const CircularProgressIndicator()
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Gwani is unavailable right now.'),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => ref.read(agentDirectoryProvider.notifier).refresh(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
      ),
    );
  }

  void _openActivity() => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => ActivityScreen(
          onOpenTalk: (id) => context.push('/talk/' + Uri.encodeComponent(id)),
          onOpenProfile: (handle) => context.push('/u/' + Uri.encodeComponent(handle)),
        )),
      );

  void _openYou() => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => _you()),
      );

  Widget _you() => YouScreen(
        onOpenProfile: () => context.push('/profile'),
        onOpenMyTalks: () => context.push('/my-talks'),
        onOpenMyTwin: () => context.push('/my-twin'),
        onOpenSaved: () => context.push('/saved-talks'),
        onOpenWallet: () => context.push('/wallet'),
        onOpenBills: () => context.push('/billing'),
        onOpenCrypto: () => context.push('/crypto'),
        onOpenSettings: () => context.push('/settings'),
      );

  Widget _page(int index) => switch (index) {
        0 => _home(),
        1 => _agents(),
        2 => _wallet(),
        3 => _privateTalk(),
        _ => const SizedBox.shrink(),
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 48,
        title: const Text('Masanawa'),
        actions: [
          IconButton(
            tooltip: 'Activity',
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: _openActivity,
          ),
          IconButton(
            tooltip: 'Profile',
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: _openYou,
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: List.generate(4, (index) =>
          _visitedTabs.contains(index) ? _page(index) : const SizedBox.shrink()),
      ),
      floatingActionButton: _index == 0 || _index == 1
          ? FloatingActionButton(
              tooltip: 'Start Talk',
              onPressed: () => context.push('/talk/create'),
              child: const Icon(Icons.add_rounded),
            )
          : null,
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
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.smart_toy_outlined),
            selectedIcon: Icon(Icons.smart_toy_rounded),
            label: 'Agents',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet_rounded),
            label: 'Wallet',
          ),
          NavigationDestination(
            icon: Icon(Icons.graphic_eq_outlined),
            selectedIcon: Icon(Icons.graphic_eq_rounded),
            label: 'Talk',
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
      context.push('/chat/' + Uri.encodeComponent(characterId) + query);
    }

    Future<void> share(TwinProfile profile) async {
      final url = profile.publicUrl;
      if (url == null || url.isEmpty) return;
      await SharePlus.instance.share(
        ShareParams(
          text: 'Talk to ' + profile.displayName + ' on Masanawa: ' + url,
        ),
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
