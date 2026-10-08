import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../agents/agent_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/agent_directory_state.dart';
import '../../state/twin_directory_state.dart';
import '../../talks/talk_models.dart';
import '../activity/activity_screen.dart';
import '../chat/ai_chat_screen.dart';
import '../talks/talk_home_screen.dart';
import '../wallet/wallet_screen.dart';
import '../you/you_screen.dart';
import 'my_twin_screen.dart';

/// Filters the server-provided roster by presentation data only. A search
/// result never grants AI Seat eligibility, a role or a service capability.
List<AgentDirectoryEntry> matchingAgentEntries(
  Iterable<AgentDirectoryEntry> entries,
  String query,
) {
  final normalized = query.trim().toLowerCase();
  if (normalized.isEmpty) return entries.toList(growable: false);
  return [
    for (final agent in entries)
      if ([agent.displayName, agent.roleLabel, agent.about]
          .join(' ')
          .toLowerCase()
          .contains(normalized))
        agent,
  ];
}

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
  final _agentSearchController = TextEditingController();
  String _agentQuery = '';

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, 3).toInt();
    _visitedTabs = <int>{_index};
  }

  @override
  void dispose() {
    _agentSearchController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant TwinHomeShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialIndex != widget.initialIndex) {
      _index = widget.initialIndex.clamp(0, 3).toInt();
      _visitedTabs.add(_index);
    }
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

  Widget _home() => TalkHomeScreen(
        onOpenTalk: _openTalk,
        onOpenSearch: () => context.push('/search'),
        onOpenGwani: _openPrivateGwani,
        embeddedInShell: true,
      );

  Widget _agents() {
    final directory = ref.watch(agentDirectoryProvider);
    final agents = matchingAgentEntries(directory.agents, _agentQuery);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 0,
          primary: false,
          bottom: const TabBar(
            tabs: [Tab(text: 'Masanawa Agents'), Tab(text: 'Twins')],
          ),
        ),
        body: TabBarView(
          children: [
            RefreshIndicator(
              onRefresh: () => ref.read(agentDirectoryProvider.notifier).refresh(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                    child: TextField(
                      controller: _agentSearchController,
                      onChanged: (value) => setState(() {
                        _agentQuery = value.trim().toLowerCase();
                      }),
                      decoration: InputDecoration(
                        hintText: 'Search Masanawa Agents',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _agentQuery.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear agent search',
                                icon: const Icon(Icons.close),
                                onPressed: () {
                                  _agentSearchController.clear();
                                  setState(() => _agentQuery = '');
                                },
                              ),
                      ),
                    ),
                  ),
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
                  // Do not infer a persona's authority from its name or role:
                  // the server owns which identities are published here.
                  for (final agent in agents)
                    ListTile(
                      key: ValueKey('platform-agent-' + agent.characterId),
                      leading: CircleAvatar(child: Text(agent.initial)),
                      title: Text(agent.displayName),
                      subtitle: Text(agent.roleLabel + ' · ' + agent.presenceLabel),
                      trailing: const Icon(Icons.chat_bubble_outline_rounded),
                      onTap: () => context.push(
                        '/chat/' + Uri.encodeComponent(agent.characterId)),
                    ),
                  if (!directory.loading && agents.isEmpty && directory.error == null)
                    ListTile(title: Text(directory.agents.isEmpty
                        ? 'No Masanawa Agents available yet.'
                        : 'No agents match your search.')),
                ],
              ),
            ),
            _PublicTwinsPanel(
              onOpenTwin: (publicId) => context.push(
                '/persona/' + Uri.encodeComponent(publicId)),
              onChatTwin: (characterId) => context.push(
                '/chat/' + Uri.encodeComponent(characterId)),
              onOpenMyTwin: () => context.push('/my-twin'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _wallet() => WalletScreen(
        embeddedInShell: true,
        onOpenCrypto: () => context.push('/crypto'),
        onOpenBillingService: (service) => context.push(
          '/billing?service=' + Uri.encodeQueryComponent(service)),
      );

  Widget _privateTalk() {
    final directory = ref.watch(agentDirectoryProvider);
    final agent = _supportAgent();
    if (agent != null) {
      // Private chat owns its own voice controls; tab selection never
      // grants microphone permission or broadcasts public Talk audio.
      return AiChatScreen(
        key: ValueKey('private-talk-' + agent.characterId),
        characterId: agent.characterId,
        embeddedInShell: true,
        onOpenAgents: () => setState(() {
          _index = 1;
          _visitedTabs.add(1);
        }),
        onOpenActivity: _openActivity,
        onOpenProfile: _openYou,
      );
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
      appBar: _index == 3 ? null : AppBar(
        toolbarHeight: 48,
        title: Text(_index == 0 ? 'Masanawa' : _index == 1 ? 'Agents' : 'Wallet'),
        actions: [
          if (_index == 0)
            IconButton(
              tooltip: 'Search Talks',
              icon: const Icon(Icons.search_rounded),
              onPressed: () => context.push('/search'),
            ),
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
        // Unmount private voice/chat when the user leaves Talk, rather than
        // retaining a potentially active microphone behind another tab.
        children: List.generate(4, (index) =>
          _visitedTabs.contains(index) && (index != 3 || _index == 3)
              ? _page(index)
              : const SizedBox.shrink()),
      ),
      floatingActionButton: (_index == 0 || _index == 1) &&
              MediaQuery.viewInsetsOf(context).bottom == 0
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

/// Public Twin discovery reuses the authenticated Gateway's canonical
/// twin directory; it is separate from managing one's own Twin.
class _PublicTwinsPanel extends ConsumerStatefulWidget {
  const _PublicTwinsPanel({
    required this.onOpenTwin,
    required this.onChatTwin,
    required this.onOpenMyTwin,
  });

  final ValueChanged<String> onOpenTwin;
  final ValueChanged<String> onChatTwin;
  final VoidCallback onOpenMyTwin;

  @override
  ConsumerState<_PublicTwinsPanel> createState() => _PublicTwinsPanelState();
}

class _PublicTwinsPanelState extends ConsumerState<_PublicTwinsPanel> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final state = ref.read(twinDirectoryProvider);
      if (!state.loading && state.items.isEmpty) {
        ref.read(twinDirectoryProvider.notifier).loadInitial();
      }
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(twinDirectoryProvider);
    final transport = ref.read(twinDirectoryProvider.notifier);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            controller: _search,
            onChanged: (value) {
              transport.setQuery(value);
              setState(() {});
            },
            decoration: InputDecoration(
              hintText: 'Search public Twins',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _search.clear();
                        transport.setQuery('');
                        setState(() {});
                      },
                    ),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: transport.loadInitial,
            child: ListView(
              key: const ValueKey('public-twins-list'),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                ListTile(
                  leading: const Icon(Icons.person_outline_rounded),
                  title: const Text('My Twin'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: widget.onOpenMyTwin,
                ),
                if (state.loading && state.items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (state.error != null)
                  ListTile(
                    title: Text(state.error!),
                    trailing: TextButton(
                      onPressed: transport.loadInitial,
                      child: const Text('Retry'),
                    ),
                  ),
                if (!state.loading && state.items.isEmpty && state.error == null)
                  const ListTile(title: Text('No public Twins found.')),
                for (final twin in state.items)
                  ListTile(
                    key: ValueKey('public-twin-' + twin.publicId),
                    leading: CircleAvatar(child: Text(twin.initials)),
                    title: Text(twin.displayName),
                    subtitle: twin.bio.isEmpty
                        ? const Text('Public Twin')
                        : Text(twin.bio, maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                    onTap: () => widget.onOpenTwin(twin.publicId),
                    trailing: TextButton(
                      onPressed: () => widget.onChatTwin(twin.characterId),
                      child: const Text('Talk'),
                    ),
                  ),
                if (state.nextCursor != null)
                  TextButton(
                    onPressed: state.loadingMore ? null : transport.loadMore,
                    child: Text(state.loadingMore ? 'Loading…' : 'Load more'),
                  ),
              ],
            ),
          ),
        ),
      ],
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
