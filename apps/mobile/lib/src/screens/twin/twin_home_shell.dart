import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../agents/agent_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/agent_directory_state.dart';
import '../../talks/talk_models.dart';
import '../activity/activity_screen.dart';
import '../talks/create_talk_screen.dart';
import '../talks/talk_home_screen.dart';
import '../you/you_screen.dart';
import 'my_twin_screen.dart';

/// Compatibility class name retained while the consumer shell is migrated.
///
/// Product shell is now: Home · Create · Activity · You.
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
        onOpenGwani: _openPrivateGwani,
      );

  Widget _create() => CreateTalkScreen(
        onCreated: _openCreatedTalk,
      );

  Widget _you() => YouScreen(
        onOpenProfile: () => context.push('/profile'),
        onOpenMyTwin: () => context.push('/my-twin'),
        onOpenWallet: () => context.push('/wallet'),
        onOpenBills: () => context.push('/billing'),
        onOpenCrypto: () => context.push('/crypto'),
        onOpenSettings: () => context.push('/settings'),
      );

  Widget _page(int index) {
    return switch (index) {
      0 => _home(),
      1 => _create(),
      2 => ActivityScreen(
          onOpenTalk: (talkId) => context.push(
            '/talk/' + Uri.encodeComponent(talkId),
          ),
        ),
      3 => _you(),
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
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_circle_outline_rounded),
            selectedIcon: Icon(Icons.add_circle_rounded),
            label: 'Create',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_none_outlined),
            selectedIcon: Icon(Icons.notifications_rounded),
            label: 'Activity',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'You',
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
