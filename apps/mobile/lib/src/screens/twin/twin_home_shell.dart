import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../agents/twin_directory.dart';
import '../../agents/twin_profile.dart';
import '../../state/wallet_state.dart';
import '../activity/activity_screen.dart';
import '../explore/explore_screen.dart';
import '../wallet/send_credits_sheet.dart';
import '../wallet/wallet_screen.dart';
import 'my_twin_screen.dart';
import 'twin_share_sheet.dart';

/// Consumer-facing Masanawa root.
///
/// Runtime details such as Characters, Skills, Agent Float and providers stay behind
/// this shell. The ordinary user navigates only My Twin, Explore, Activity and Wallet.
class TwinHomeShell extends ConsumerStatefulWidget {
  const TwinHomeShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  ConsumerState<TwinHomeShell> createState() => _TwinHomeShellState();
}

class _TwinHomeShellState extends ConsumerState<TwinHomeShell> {
  late int _index = widget.initialIndex.clamp(0, 3).toInt();

  void _openTwin(TwinDirectoryEntry twin) {
    context.push('/chat/${Uri.encodeComponent(twin.characterId)}');
  }

  void _openOwnedTwin(String characterId) {
    context.push('/chat/${Uri.encodeComponent(characterId)}');
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

  Widget _page(int index) {
    return switch (index) {
      0 => MyTwinScreen(
          onCreateTwin: () => context.push('/clone'),
          onTalkToTwin: _openOwnedTwin,
          onTeachTwin: _openOwnedTwin,
          onShareTwin: _shareTwin,
          onOpenSettings: () => context.push('/settings'),
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
