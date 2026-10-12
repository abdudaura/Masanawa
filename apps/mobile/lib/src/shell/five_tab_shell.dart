import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../screens/calls/calls_screen.dart';
import '../screens/chat/chat_list_screen.dart';
import '../screens/rooms/rooms_screen.dart';
import '../screens/talks/talk_home_screen.dart';
import '../talks/talk_models.dart';
import '../screens/wallet/wallet_screen.dart';
import '../screens/twin/shell_tab.dart';
import '../ui/components/masanawa_main_header.dart';
import '../theme/masanawa_theme.dart';

/// Canonical five-tab root shell: Chats · Status · Wallet · Calls · Rooms.
///
/// This replaces the retired Home · Agents · Wallet · Talk shell. Each tab
/// owns its screen; tabs only switch, they never fetch.
class FiveTabShell extends ConsumerStatefulWidget {
  const FiveTabShell({super.key, this.initialIndex = 0});
  final int initialIndex;

  @override
  ConsumerState<FiveTabShell> createState() => _FiveTabShellState();
}

class _FiveTabShellState extends ConsumerState<FiveTabShell> {
  late int _index;
  late final Set<int> _visitedTabs;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex.clamp(0, 4).toInt();
    _visitedTabs = <int>{_index};
  }

  @override
  void didUpdateWidget(covariant FiveTabShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialIndex != widget.initialIndex) {
      _index = widget.initialIndex.clamp(0, 4).toInt();
      _visitedTabs.add(_index);
    }
  }

  void _selectTab(int index) {
    if (index == _index) return;
    setState(() {
      _index = index;
      _visitedTabs.add(index);
    });
    context.go(MasanawaRootTab.values[index].location);
  }

  Widget _page(int index) => switch (index) {
    0 => const ChatListScreen(),
    1 => TalkHomeScreen(
      onOpenTalk: (TalkDiscoveryItem talk) =>
          context.push('/talk/' + Uri.encodeComponent(talk.id)),
      onOpenSearch: () => context.push('/search'),
      onOpenGwani: () => context.push('/billing'),
      embeddedInShell: true,
    ),
    2 => WalletScreen(
      embeddedInShell: true,
      onOpenCrypto: () => context.push('/crypto'),
      onOpenBillingService: (service) =>
          context.push('/billing?service=' + Uri.encodeQueryComponent(service)),
    ),
    3 => const CallsScreen(),
    _ => const RoomsScreen(),
  };

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: _index == 1 || _index == 2 ? masanawaMainHeader(context) : null,
      body: IndexedStack(
        index: _index,
        children: List.generate(
          5,
          (index) => _visitedTabs.contains(index)
              ? _page(index)
              : const SizedBox.shrink(),
        ),
      ),
      floatingActionButton: switch (_index) {
        0 => FloatingActionButton(
          tooltip: 'New chat',
          onPressed: () => context.push('/masana'),
          child: const Icon(Icons.chat_rounded),
        ),
        1 => FloatingActionButton(
          tooltip: 'New status',
          onPressed: () => context.push('/talk/create'),
          child: const Icon(Icons.add_rounded),
        ),
        _ => null,
      },
      bottomNavigationBar: DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(color: context.masanawa.structuralBorder),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _selectTab,
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.chat_bubble_outline),
              selectedIcon: const Icon(Icons.chat_bubble),
              label: strings.chats,
            ),
            NavigationDestination(
              icon: const Icon(Icons.donut_large),
              selectedIcon: const Icon(Icons.donut_large),
              label: strings.status,
            ),
            NavigationDestination(
              icon: const Icon(Icons.account_balance_wallet_outlined),
              selectedIcon: const Icon(Icons.account_balance_wallet),
              label: strings.wallet,
            ),
            NavigationDestination(
              icon: const Icon(Icons.call_outlined),
              selectedIcon: const Icon(Icons.call),
              label: strings.calls,
            ),
            NavigationDestination(
              icon: const Icon(Icons.groups_outlined),
              selectedIcon: const Icon(Icons.groups),
              label: strings.rooms,
            ),
          ],
        ),
      ),
    );
  }
}
