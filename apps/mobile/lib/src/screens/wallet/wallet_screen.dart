import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../commerce/wallet_models.dart';
import '../../state/wallet_state.dart';
import '../../theme/masanawa_theme.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({
    super.key,
    this.onAddMoney,
    this.onSend,
    this.onWithdraw,
    this.onBuyBills,
    this.onOpenCrypto,
  });

  final VoidCallback? onAddMoney;
  final VoidCallback? onSend;
  final VoidCallback? onWithdraw;
  final VoidCallback? onBuyBills;
  final VoidCallback? onOpenCrypto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final wallet = ref.watch(walletProvider);

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Wallet')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(walletProvider.notifier).refresh(),
        child: wallet.when(
          loading: () => const _ScrollableCenter(
            child: CircularProgressIndicator(),
          ),
          error: (_, __) => _ScrollableCenter(
            child: Text(
              'Wallet is not available yet.',
              style: TextStyle(color: u.textMuted),
            ),
          ),
          data: (value) {
            if (value == null) return const SizedBox.shrink();
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                _Balances(view: value),
                const SizedBox(height: 12),
                _Actions(
                  onAddMoney: onAddMoney,
                  onSend: onSend,
                  onWithdraw: onWithdraw,
                ),
                if (onBuyBills != null || onOpenCrypto != null) ...[
                  const SizedBox(height: 12),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final textScale =
                          MediaQuery.textScalerOf(context).scale(1);
                      final stacked =
                          constraints.maxWidth < 360 || textScale > 1.25;
                      final buttons = <Widget>[
                        if (onBuyBills != null)
                          OutlinedButton.icon(
                            onPressed: onBuyBills,
                            icon: const Icon(Icons.receipt_long_outlined),
                            label: const Text('Bills'),
                          ),
                        if (onOpenCrypto != null)
                          OutlinedButton.icon(
                            onPressed: onOpenCrypto,
                            icon: const Icon(Icons.currency_bitcoin),
                            label: const Text('Crypto'),
                          ),
                      ];
                      if (stacked) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (var i = 0; i < buttons.length; i++) ...[
                              buttons[i],
                              if (i != buttons.length - 1)
                                const SizedBox(height: 8),
                            ],
                          ],
                        );
                      }
                      return Row(
                        children: [
                          for (var i = 0; i < buttons.length; i++) ...[
                            Expanded(child: buttons[i]),
                            if (i != buttons.length - 1)
                              const SizedBox(width: 8),
                          ],
                        ],
                      );
                    },
                  ),
                ],
                const SizedBox(height: 20),
                Text(
                  'History',
                  style: TextStyle(
                    color: u.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                if (value.entries.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Text(
                      'No wallet activity yet.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: u.textMuted),
                    ),
                  )
                else
                  ...value.entries.map((entry) => _WalletEntryTile(entry: entry)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Balances extends StatelessWidget {
  const _Balances({required this.view});
  final WalletView view;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Spendable Credits', style: TextStyle(color: u.textMuted)),
          const SizedBox(height: 4),
          Text(
            '${view.spendableCredits} Cr',
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final textScale = MediaQuery.textScalerOf(context).scale(1);
              final stacked =
                  constraints.maxWidth < 300 || textScale > 1.5;
              final items = [
                _SmallBalance(
                  label: 'Pending',
                  value: '${view.pendingEarningsCredits} Cr',
                ),
                _SmallBalance(
                  label: 'Available',
                  value: '${view.availableEarningsCredits} Cr',
                ),
              ];
              if (stacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    items[0],
                    const SizedBox(height: 12),
                    items[1],
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(child: items[0]),
                  Expanded(child: items[1]),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SmallBalance extends StatelessWidget {
  const _SmallBalance({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: u.textMuted, fontSize: 12)),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.onAddMoney,
    required this.onSend,
    required this.onWithdraw,
  });

  final VoidCallback? onAddMoney;
  final VoidCallback? onSend;
  final VoidCallback? onWithdraw;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        if (constraints.maxWidth < 380 || textScale > 1.25) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton.icon(
                onPressed: onAddMoney,
                icon: const Icon(Icons.add),
                label: const Text('Add money'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: onSend,
                icon: const Icon(Icons.send_outlined),
                label: const Text('Send'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: onWithdraw,
                icon: const Icon(Icons.south_west),
                label: const Text('Withdraw'),
              ),
            ],
          );
        }
        return Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: onAddMoney,
                icon: const Icon(Icons.add),
                label: const Text('Add money'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onSend,
                icon: const Icon(Icons.send_outlined),
                label: const Text('Send'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.outlined(
              tooltip: 'Withdraw',
              onPressed: onWithdraw,
              icon: const Icon(Icons.south_west),
            ),
          ],
        );
      },
    );
  }
}

class _WalletEntryTile extends StatelessWidget {
  const _WalletEntryTile({required this.entry});
  final WalletEntry entry;

  IconData get icon {
    switch (entry.kind) {
      case WalletEntryKind.funding: return Icons.add_circle_outline;
      case WalletEntryKind.transferSent: return Icons.north_east;
      case WalletEntryKind.transferReceived: return Icons.south_west;
      case WalletEntryKind.purchase: return Icons.shopping_bag_outlined;
      case WalletEntryKind.commission: return Icons.percent;
      case WalletEntryKind.gift: return Icons.card_giftcard_outlined;
      case WalletEntryKind.voice: return Icons.graphic_eq;
      case WalletEntryKind.ownerSession: return Icons.person_outline;
      case WalletEntryKind.refund: return Icons.replay_outlined;
      case WalletEntryKind.withdrawal: return Icons.account_balance_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final sign = entry.incoming ? '+' : '-';
    final largeText = MediaQuery.textScalerOf(context).scale(1) > 1.3;
    return Semantics(
      label: '${entry.title}. ${entry.incoming ? "Received" : "Spent"} ${entry.amountCredits} Credits',
      child: Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: u.structuralBorder),
      ),
      child: ListTile(
        leading: Icon(icon, color: u.brand),
        title: Text(
          entry.title,
          style: TextStyle(color: u.textPrimary, fontSize: 14),
        ),
        subtitle: largeText
            ? Text(
                '$sign${entry.amountCredits} Cr',
                style: TextStyle(
                  color: u.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              )
            : null,
        trailing: largeText
            ? null
            : Text(
                '$sign${entry.amountCredits} Cr',
                style: TextStyle(
                  color: u.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
      ),
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
