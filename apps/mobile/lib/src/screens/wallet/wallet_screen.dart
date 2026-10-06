import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../commerce/wallet_models.dart';
import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../state/wallet_state.dart';
import '../../theme/masanawa_theme.dart';

/// Wallet is deliberately presented as a conversation surface rather than a
/// banking dashboard. Canonical balances and history still come from Wallet.
class WalletScreen extends ConsumerWidget {
  const WalletScreen({
    super.key,
    this.onAddMoney,
    this.onSend,
    this.onWithdraw,
    this.onBuyBills,
    this.onOpenCrypto,
    this.onTalkToGwani,
  });

  final VoidCallback? onAddMoney;
  final VoidCallback? onSend;
  final VoidCallback? onWithdraw;
  final VoidCallback? onBuyBills;
  final VoidCallback? onOpenCrypto;
  final VoidCallback? onTalkToGwani;

  void _askGwani(BuildContext context, WidgetRef ref, String request) {
    final directory = ref.read(agentDirectoryProvider);
    final matches = directory.agents.where(
      (agent) =>
          agent.supportAgent &&
          agent.displayName.trim().toLowerCase() == 'gwani',
    ).toList();
    final defaults = directory.agents.where(
      (agent) => agent.supportAgent && agent.defaultPlatformAgent,
    ).toList();
    final guide = matches.isNotEmpty
        ? matches.first
        : defaults.isNotEmpty
            ? defaults.first
            : null;
    if (guide == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gwani is unavailable. Refresh Agents and try again.')),
      );
      return;
    }
    final chat = ref.read(aiChatProvider.notifier);
    chat.seedGreeting(
      guide.characterId,
      'Tell me what you want to do with your wallet. You can speak naturally.',
    );
    chat.sendText(guide.characterId, request);
    context.push('/chat/${guide.characterId}');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final wallet = ref.watch(walletProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Wallet'),
        actions: [
          IconButton(
            tooltip: 'Refresh balance',
            onPressed: () => ref.read(walletProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(walletProvider.notifier).refresh(),
        child: wallet.when(
          loading: () => const _ScrollableCenter(child: CircularProgressIndicator()),
          error: (_, __) => _ScrollableCenter(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.chat_bubble_outline_rounded, size: 44, color: u.brand),
                const SizedBox(height: 12),
                Text(
                  'I could not load your wallet yet.',
                  style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text('Pull down to try again.', style: TextStyle(color: u.textMuted)),
              ],
            ),
          ),
          data: (value) {
            if (value == null) return const SizedBox.shrink();
            return ListView(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
              children: [
                _BalanceMessage(view: value),
                const SizedBox(height: 10),
                const _AgentMessage(
                  text:
                      'Tell me what you want to do. You can speak naturally — fund your wallet, buy airtime or bills, send money, or use crypto.',
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _ActionChip(
                      icon: Icons.add_rounded,
                      label: 'Fund wallet',
                      onTap: onAddMoney ?? () => _askGwani(context, ref, 'I want to fund my wallet.'),
                    ),
                    _ActionChip(
                      icon: Icons.receipt_long_outlined,
                      label: 'Buy bills',
                      onTap: onBuyBills ?? () => _askGwani(context, ref, 'I want to buy a billing service.'),
                    ),
                    _ActionChip(
                      icon: Icons.currency_bitcoin_rounded,
                      label: 'Crypto',
                      onTap: onOpenCrypto ?? () => _askGwani(
                        context,
                        ref,
                        'I want to use crypto. Show me the available crypto actions and guide me in chat.',
                      ),
                    ),
                    _ActionChip(
                      icon: Icons.send_outlined,
                      label: 'Send',
                      onTap: onSend ?? () => _askGwani(context, ref, 'I want to send money or Credits.'),
                    ),
                    _ActionChip(
                      icon: Icons.account_balance_outlined,
                      label: 'Withdraw',
                      onTap: onWithdraw ?? () => _askGwani(context, ref, 'I want to withdraw.'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                  const _AgentMessage(
                    text:
                        'Crypto is available here too. Ask me to buy, deposit, convert, check a balance, or withdraw and I will guide you in chat.',
                    icon: Icons.currency_bitcoin_rounded,
                  ),
                const SizedBox(height: 18),
                if (value.entries.isNotEmpty) ...[
                  Text(
                    'Recent activity',
                    style: TextStyle(
                      color: u.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 7),
                  ...value.entries.take(8).map((entry) => _WalletEntryBubble(entry: entry)),
                ],
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: onTalkToGwani ?? () => _askGwani(context, ref, 'Help me with my wallet.'),
                  icon: const Icon(Icons.mic_rounded),
                  label: const Text('Talk to Gwani'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Voice is preferred. Text always works too.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted, fontSize: 12),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _BalanceMessage extends StatelessWidget {
  const _BalanceMessage({required this.view});
  final WalletView view;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 330),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: u.surfaceCard,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(6),
            topRight: Radius.circular(20),
            bottomLeft: Radius.circular(20),
            bottomRight: Radius.circular(20),
          ),
          border: Border.all(color: u.structuralBorder),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: u.brand.withValues(alpha: .10),
              child: Icon(Icons.account_balance_wallet_outlined, color: u.brand),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'You have ${view.spendableCredits} Credits available.',
                    style: TextStyle(
                      color: u.textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (view.pendingEarningsCredits > 0 ||
                      view.availableEarningsCredits > 0) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${view.availableEarningsCredits} earnings available'
                      '${view.pendingEarningsCredits > 0 ? ' · ${view.pendingEarningsCredits} pending' : ''}.',
                      style: TextStyle(color: u.textMuted, fontSize: 12.5),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AgentMessage extends StatelessWidget {
  const _AgentMessage({required this.text, this.icon = Icons.graphic_eq_rounded});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: u.brand.withValues(alpha: .075),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: u.brand, size: 21),
            const SizedBox(width: 9),
            Expanded(
              child: Text(text, style: TextStyle(color: u.textPrimary, height: 1.4)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ActionChip(
      avatar: Icon(icon, size: 18, color: onTap == null ? u.textMuted : u.brand),
      label: Text(label),
      onPressed: onTap,
      backgroundColor: u.surfaceCard,
      side: BorderSide(color: u.structuralBorder),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
    );
  }
}

class _WalletEntryBubble extends StatelessWidget {
  const _WalletEntryBubble({required this.entry});
  final WalletEntry entry;

  IconData get icon => switch (entry.kind) {
        WalletEntryKind.funding => Icons.add_circle_outline,
        WalletEntryKind.transferSent => Icons.north_east,
        WalletEntryKind.transferReceived => Icons.south_west,
        WalletEntryKind.purchase => Icons.shopping_bag_outlined,
        WalletEntryKind.commission => Icons.percent,
        WalletEntryKind.gift => Icons.card_giftcard_outlined,
        WalletEntryKind.voice => Icons.graphic_eq,
        WalletEntryKind.ownerSession => Icons.person_outline,
        WalletEntryKind.refund => Icons.replay_outlined,
        WalletEntryKind.withdrawal => Icons.account_balance_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final sign = entry.incoming ? '+' : '-';
    return Container(
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: u.brand, size: 19),
          const SizedBox(width: 9),
          Expanded(
            child: Text(entry.title, style: TextStyle(color: u.textPrimary, fontSize: 13.5)),
          ),
          Text(
            '$sign${entry.amountCredits} Cr',
            style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.sizeOf(context).height * .55,
          child: Center(child: child),
        ),
      ],
    );
  }
}
