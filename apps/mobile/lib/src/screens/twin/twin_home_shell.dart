import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../l10n/app_localizations.dart';
import '../../agents/agent_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/agent_directory_state.dart';
import '../../audio_posts/audio_post_destination.dart';
import '../../audio_posts/audio_post_transport.dart';
import '../../core/providers.dart';
import '../../state/session_state.dart';
import '../../state/talk_social_profile_state.dart';
import '../../social/profile_header.dart';
import '../chat/ai_chat_screen.dart';
import '../chat/chat_list_screen.dart';
import '../wallet/wallet_screen.dart';
import 'my_twin_screen.dart';
import 'shell_tab.dart';

// Reuse one authenticated ApiClient and stable transport while the shell
// rebuilds; replacing the transport on each frame would reset pagination.
final _publishedPostsTransportProvider = Provider<GatewayAudioPostTransport>(
  (ref) => GatewayAudioPostTransport(ref.watch(apiClientProvider)),
);

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

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, 4).toInt();
    _visitedTabs = <int>{_index};
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

  // The published Talks service is distinct from the historical live-session
  // product. The Gateway transport uses the canonical signed-in access token.
  // Private media upload/playback, Following and reporting stay disabled until
  // their authoritative backend bindings are registered, not fake-adapted.
  Widget _publishedTalks() {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return _unavailableAudioDestination(
        icon: Icons.graphic_eq_rounded,
        title: AppLocalizations.of(context).talksPendingTitle,
        explanation: AppLocalizations.of(context).talksPendingDetail,
      );
    }
    final accountId = session.user.id;
    return PublishedTalksDestination(
      key: ValueKey('published-talks-' + accountId),
      accountId: accountId,
      transport: ref.watch(_publishedPostsTransportProvider),
      isCurrentAccount: (id) {
        final current = ref.read(sessionProvider);
        return current is SessionSignedIn && current.user.id == id;
      },
    );
  }

  // AF10 Rooms remains unavailable until its own durable room API exists.
  // AF09 posts are never represented by the historic live-session feed.

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
          title: AppLocalizations.of(context).roomsPendingTitle,
          explanation: AppLocalizations.of(context).roomsPendingDetail,
        ),
        2 => _publishedTalks(),
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
          _index == 1 ? strings.navRooms : _index == 2 ? strings.navTalks : strings.wallet,
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
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: const Icon(Icons.chat_bubble_rounded),
            label: strings.navChats,
          ),
          NavigationDestination(
            icon: const Icon(Icons.groups_outlined),
            selectedIcon: const Icon(Icons.groups_rounded),
            label: strings.navRooms,
          ),
          NavigationDestination(
            icon: const Icon(Icons.graphic_eq_outlined),
            selectedIcon: const Icon(Icons.graphic_eq_rounded),
            label: strings.navTalks,
          ),
          NavigationDestination(
            icon: const Icon(Icons.smart_toy_outlined),
            selectedIcon: const Icon(Icons.smart_toy_rounded),
            label: strings.navGwani,
          ),
          NavigationDestination(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: const Icon(Icons.account_balance_wallet_rounded),
            label: strings.wallet,
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
