import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../l10n/app_localizations.dart';
import '../../agents/agent_directory.dart';
import '../../agents/twin_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/agent_directory_state.dart';
import '../../state/session_state.dart';
import '../../state/talk_social_profile_state.dart';
import '../../social/profile_header.dart';
import '../../state/twin_directory_state.dart';
import '../../talks/talk_models.dart';
import '../chat/ai_chat_screen.dart';
import '../chat/chat_list_screen.dart';
import '../talks/talk_home_screen.dart';
import '../wallet/wallet_screen.dart';
import 'my_twin_screen.dart';
import 'shell_tab.dart';

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

/// Server-presence types, never English labels, determine translated status.
/// Unknown or cached presence must remain unverified, not available/offline.
String localizedAgentPresence(
  AppLocalizations strings,
  AgentDirectoryEntry agent,
) {
  if (agent.presence == AgentPresence.working && agent.activeWorkCount > 0) {
    return strings.statusWorkingTasks(agent.activeWorkCount);
  }
  return switch (agent.presence) {
    AgentPresence.available => strings.statusAvailable,
    AgentPresence.listening => strings.statusListening,
    AgentPresence.working => strings.statusWorking,
    AgentPresence.onCall => strings.statusOnCall,
    AgentPresence.offline => strings.statusOffline,
    AgentPresence.unknown => strings.statusUnverified,
  };
}

/// Compatibility class name retained while the consumer shell is migrated.
///
/// Approved root shell: Chats · Rooms · Talks · Gwani · Wallet.
/// Audio posts/Rooms have separate authorities; old live Talks are not posts.
class TwinHomeShell extends ConsumerStatefulWidget {
  const TwinHomeShell({super.key, this.initialIndex = 2});
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
    _index = widget.initialIndex.clamp(0, 4).toInt();
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
      _index = widget.initialIndex.clamp(0, 4).toInt();
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
        SnackBar(content: Text(AppLocalizations.of(context).gwaniUnavailableRetry)),
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
    final strings = AppLocalizations.of(context);
    final agents = matchingAgentEntries(directory.agents, _agentQuery);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 0,
          primary: false,
          bottom: TabBar(
            tabs: [
              Tab(text: strings.platformAgentsTab),
              Tab(text: strings.twinsTab),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            RefreshIndicator(
              onRefresh: () => ref.read(agentDirectoryProvider.notifier).refresh(),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(bottom: 96),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                    child: TextField(
                      controller: _agentSearchController,
                      onChanged: (value) => setState(() {
                        _agentQuery = value.trim().toLowerCase();
                      }),
                      decoration: InputDecoration(
                        hintText: strings.searchPlatformAgents,
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _agentQuery.isEmpty
                            ? null
                            : IconButton(
                                tooltip: strings.clearAgentSearch,
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
                      title: Text(strings.agentsLoadFailed),
                      trailing: TextButton(
                        onPressed: () => ref.read(agentDirectoryProvider.notifier).refresh(),
                        child: Text(strings.retry),
                      ),
                    ),
                  // Do not infer a persona's authority from its name or role:
                  // the server owns which identities are published here.
                  for (final agent in agents)
                    ListTile(
                      key: ValueKey('platform-agent-' + agent.characterId),
                      leading: CircleAvatar(child: Text(agent.initial)),
                      title: Text(agent.displayName),
                      subtitle: Text(
                        agent.roleLabel + ' · ' +
                        localizedAgentPresence(strings, agent),
                      ),
                      trailing: const Icon(Icons.chat_bubble_outline_rounded),
                      onTap: () => context.push(
                        '/chat/' + Uri.encodeComponent(agent.characterId)),
                    ),
                  if (!directory.loading && agents.isEmpty && directory.error == null)
                    ListTile(title: Text(directory.agents.isEmpty
                        ? strings.noPlatformAgents
                        : strings.noMatchingAgents)),
                ],
              ),
            ),
            _PublicTwinsPanel(
              onOpenTwin: (publicId) => context.push(
                '/persona/' + Uri.encodeComponent(publicId)),
              onChatTwin: _openPublicTwinChat,
              onOpenMyTwin: () => context.push('/my-twin'),
            ),
          ],
        ),
      ),
    );
  }

  /// Public discovery does not itself prove an authenticated private agent
  /// workspace exists. Check the canonical roster, then provide recovery
  /// instead of opening a chat that cannot resolve its character.
  Future<void> _openPublicTwinChat(TwinDirectoryEntry twin) async {
    var agent = ref.read(agentDirectoryProvider).find(twin.characterId);
    if (agent == null) {
      await ref.read(agentDirectoryProvider.notifier).refresh();
      if (!mounted) return;
      agent = ref.read(agentDirectoryProvider).find(twin.characterId);
    }
    if (!mounted) return;
    if (agent == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              AppLocalizations.of(context)
                  .privateTwinTalkUnavailable(twin.displayName),
            ),
          action: SnackBarAction(
            label: AppLocalizations.of(context).viewTwinProfile,
            onPressed: () => context.push(
              '/persona/' + Uri.encodeComponent(twin.publicId)),
          ),
        ),
      );
      return;
    }
    context.push('/chat/' + Uri.encodeComponent(agent.characterId));
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
    final strings = AppLocalizations.of(context);
    if (agent != null) {
      // Private chat owns its own voice controls; tab selection never
      // grants microphone permission or broadcasts public Talk audio.
      return AiChatScreen(
        key: ValueKey('private-talk-' + agent.characterId),
        characterId: agent.characterId,
        embeddedInShell: true,
        onOpenAgents: () => context.push('/agents'),
        onOpenActivity: _openActivity,
        onOpenProfile: _openYou,
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Gwani')),
      body: Center(
        child: directory.loading
            ? const CircularProgressIndicator()
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(strings.gwaniUnavailableNow),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => ref.read(agentDirectoryProvider.notifier).refresh(),
                    child: Text(strings.retry),
                  ),
                ],
              ),
      ),
    );
  }

  void _openActivity() => context.push('/activity');

  void _openYou() => context.push('/you');

  // AF09/AF10 own durable audio posts and rooms. Neither API exists in
  // current main. Do not repackage the historic live-session feed as posts.
  Widget _unavailableAudioDestination({
    required IconData icon,
    required String title,
    required String explanation,
  }) =>
      Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 44, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              Text(title, style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(explanation, textAlign: TextAlign.center),
            ],
          ),
        ),
      );

  Widget _page(int index) => switch (index) {
        0 => const ChatListScreen(),
        1 => _unavailableAudioDestination(
          icon: Icons.groups_outlined,
          title: 'Rooms are not available yet',
          explanation: 'Audio groups will appear here when the Rooms service is ready.',
        ),
        2 => _unavailableAudioDestination(
          icon: Icons.graphic_eq_rounded,
          title: 'Audio posts are not available yet',
          explanation: 'Published voice posts will appear here when the Talks service is ready.',
        ),
        3 => _privateTalk(),
        4 => _wallet(),
        _ => const SizedBox.shrink(),
      };

  void _selectTab(int index) {
    if (index == _index) return;
    setState(() {
      _index = index;
      _visitedTabs.add(index);
    });
    context.go(MasanawaRootTab.values[index].location);
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final session = ref.watch(sessionProvider);
    final publicProfile = session is SessionSignedIn
        ? ref.watch(humanProfileByUserIdProvider(session.user.id)).asData?.value
        : null;
    final header = resolveProfileHeader(
      sessionName: session is SessionSignedIn ? session.user.name : '',
      publicDisplayName: publicProfile?.displayName,
      publicAvatarUrl: publicProfile?.avatarUrl,
    );
    return Scaffold(
      appBar: (_index == 0 || _index == 3) ? null : AppBar(
        toolbarHeight: 48,
        title: Text(
          _index == 1 ? 'Rooms' : _index == 2 ? 'Talks' : strings.wallet,
        ),
        actions: [
          IconButton(
            tooltip: strings.activity,
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: _openActivity,
          ),
          IconButton(
            tooltip: strings.profile,
            onPressed: _openYou,
            icon: CircleAvatar(
              radius: 15,
              backgroundColor: Theme.of(context).colorScheme.primary
                  .withValues(alpha: .16),
              backgroundImage: header.avatarUrl == null
                  ? null
                  : NetworkImage(header.avatarUrl!),
              child: header.avatarUrl == null
                  ? Text(
                      header.initial,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    )
                  : null,
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        // Unmount private voice/chat when the user leaves Talk, rather than
        // retaining a potentially active microphone behind another tab.
        children: List.generate(5, (index) =>
          _visitedTabs.contains(index) && (index != 3 || _index == 3)
              ? _page(index)
              : const SizedBox.shrink()),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Chats',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups_rounded),
            label: 'Rooms',
          ),
          NavigationDestination(
            icon: Icon(Icons.graphic_eq_outlined),
            selectedIcon: Icon(Icons.graphic_eq_rounded),
            label: 'Talks',
          ),
          NavigationDestination(
            icon: Icon(Icons.smart_toy_outlined),
            selectedIcon: Icon(Icons.smart_toy_rounded),
            label: 'Gwani',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet_rounded),
            label: 'Wallet',
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
  final ValueChanged<TwinDirectoryEntry> onChatTwin;
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
    final strings = AppLocalizations.of(context);
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
              hintText: strings.searchPublicTwins,
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: strings.clearTwinSearch,
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
              padding: const EdgeInsets.only(bottom: 96),
              children: [
                ListTile(
                  leading: const Icon(Icons.person_outline_rounded),
                  title: Text(strings.myTwin),
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
                    title: Text(strings.publicTwinsLoadFailed),
                    trailing: TextButton(
                      onPressed: transport.loadInitial,
                      child: Text(strings.retry),
                    ),
                  ),
                if (!state.loading && state.items.isEmpty && state.error == null)
                  ListTile(title: Text(strings.noPublicTwins)),
                for (final twin in state.items)
                  ListTile(
                    key: ValueKey('public-twin-' + twin.publicId),
                    leading: CircleAvatar(child: Text(twin.initials)),
                    title: Text(twin.displayName),
                    subtitle: twin.bio.isEmpty
                        ? Text(strings.publicTwin)
                        : Text(twin.bio, maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                    onTap: () => widget.onOpenTwin(twin.publicId),
                    trailing: TextButton(
                      onPressed: () => widget.onChatTwin(twin),
                      child: Text(strings.talk),
                    ),
                  ),
                if (state.nextCursor != null)
                  TextButton(
                    onPressed: state.loadingMore ? null : transport.loadMore,
                    child: Text(
                      state.loadingMore ? strings.loading : strings.loadMore,
                    ),
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
          text: AppLocalizations.of(context)
              .twinShareText(profile.displayName, url),
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
