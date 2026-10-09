import 'package:intl/intl.dart' show NumberFormat;
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
    this.onOpenBillingService,
    this.embeddedInShell = false,
  });

  final VoidCallback? onAddMoney;
  final VoidCallback? onSend;
  final VoidCallback? onWithdraw;
  final VoidCallback? onBuyBills;
  final VoidCallback? onOpenCrypto;
  /// Opens the existing qualified Billing category; selecting it does not pay.
  final ValueChanged<String>? onOpenBillingService;
  /// Root owns the header when this surface is selected as a bottom tab.
  final bool embeddedInShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final wallet = ref.watch(walletProvider);

    // Loading or a balance failure must not remove entry to separate,
    // independently qualified Billing/Crypto routes.
    Widget pendingOrUnavailableWallet({bool loading = false}) => ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        WalletServiceShortcuts(
          onOpenCrypto: onOpenCrypto,
          onBuyBills: onBuyBills,
          onOpenBillingService: onOpenBillingService,
        ),
        const SizedBox(height: 80),
        if (loading)
          const Center(child: CircularProgressIndicator())
        else ...[
          Text(
            'Wallet balances are unavailable right now.',
            textAlign: TextAlign.center,
            style: TextStyle(color: u.textMuted),
          ),
          const SizedBox(height: 12),
          Center(
            child: OutlinedButton(
              onPressed: () => ref.read(walletProvider.notifier).refresh(),
              child: const Text('Retry'),
            ),
          ),
        ],
      ],
    );

    return Scaffold(
      backgroundColor: u.surfaceCard,
      appBar: embeddedInShell ? null : AppBar(title: const Text('Wallet')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(walletProvider.notifier).refresh(),
        child: wallet.when(
          loading: () => pendingOrUnavailableWallet(loading: true),
          error: (_, __) => pendingOrUnavailableWallet(),
          data: (value) {
            if (value == null) return pendingOrUnavailableWallet();
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                _Balances(
                  view: value,
                  onRetry: () => ref.read(walletProvider.notifier).refresh(),
                ),
                if (onAddMoney != null || onSend != null || onWithdraw != null) ...[
                  const SizedBox(height: 12),
                  _Actions(
                    onAddMoney: onAddMoney,
                    onSend: onSend,
                    onWithdraw: onWithdraw,
                  ),
                ],
                const SizedBox(height: 16),
                WalletServiceShortcuts(
                  onOpenCrypto: onOpenCrypto,
                  onBuyBills: onBuyBills,
                  onOpenBillingService: onOpenBillingService,
                ),
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

/// Format native NGN minor units as integers: never convert financial units
/// through double, which would round large wallet balances.
String formatNativeNgnKobo(int amountKobo, String locale) {
  if (amountKobo < 0 || amountKobo > 9007199254740991) {
    throw RangeError.range(amountKobo, 0, 9007199254740991);
  }
  NumberFormat formatter;
  try {
    formatter = NumberFormat.decimalPattern(locale.replaceAll('-', '_'));
  } on ArgumentError {
    formatter = NumberFormat.decimalPattern('en');
  }
  final whole = formatter.format(amountKobo ~/ 100);
  final fractional = (amountKobo % 100).toString().padLeft(2, '0');
  return '₦$whole.$fractional';
}

class _Balances extends StatelessWidget {
  const _Balances({required this.view, required this.onRetry});
  final WalletView view;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      'MSN Balance',
                      style: TextStyle(color: u.textMuted, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: u.brand.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Platform Currency',
                        style: TextStyle(color: u.brandStrong, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '${view.spendableCredits}',
                      style: TextStyle(
                        color: u.textPrimary,
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'MSN',
                      style: TextStyle(
                        color: u.brandStrong,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (view.ngnBalanceVerified) ...[
                      const SizedBox(width: 8),
                      Text(
                        '≈ ${formatNativeNgnKobo(view.ngnBalanceKobo, Localizations.localeOf(context).toLanguageTag())}',
                        style: TextStyle(color: u.textMuted, fontSize: 13),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh balance',
            onPressed: onRetry,
            icon: Icon(Icons.sync_rounded, color: u.brandStrong),
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

/// Shared service links remain navigation-only until the private durable
/// voice-first financial task contract is integrated (R06/R07).
class WalletServiceShortcuts extends StatelessWidget {
  const WalletServiceShortcuts({
    super.key,
    this.onOpenCrypto,
    this.onBuyBills,
    this.onOpenBillingService,
  });

  final VoidCallback? onOpenCrypto;
  final VoidCallback? onBuyBills;
  final ValueChanged<String>? onOpenBillingService;

  @override
  Widget build(BuildContext context) {
    final billing = onOpenBillingService;
    if (onOpenCrypto == null && onBuyBills == null && billing == null) {
      return const SizedBox.shrink();
    }
    return Center(
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        runSpacing: 8,
        children: [
          if (onOpenCrypto != null)
            ActionChip(
              avatar: const Icon(Icons.currency_bitcoin, size: 18),
              label: const Text('Crypto'),
              onPressed: onOpenCrypto,
            ),
          if (billing != null) ...[
            ActionChip(
              avatar: const Icon(Icons.wifi, size: 18),
              label: const Text('Data bundles'),
              onPressed: () => billing('data'),
            ),
            ActionChip(
              avatar: const Icon(Icons.phone_android, size: 18),
              label: const Text('Airtime'),
              onPressed: () => billing('airtime'),
            ),
            ActionChip(
              avatar: const Icon(Icons.bolt, size: 18),
              label: const Text('Electricity'),
              onPressed: () => billing('electricity'),
            ),
            ActionChip(
              avatar: const Icon(Icons.tv, size: 18),
              label: const Text('TV / Cable'),
              onPressed: () => billing('tv'),
            ),
          ] else if (onBuyBills != null)
            ActionChip(
              avatar: const Icon(Icons.receipt_long, size: 18),
              label: const Text('Billing'),
              onPressed: onBuyBills,
            ),
        ],
      ),
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
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: onAddMoney,
            icon: const Icon(Icons.add),
            label: const Text('Deposit MSN'),
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
        if (onWithdraw != null) ...[
          const SizedBox(width: 8),
          IconButton.outlined(
            tooltip: 'Withdraw',
            onPressed: onWithdraw,
            icon: const Icon(Icons.south_west),
          ),
        ],
      ],
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
    return Container(
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
        trailing: Text(
          '$sign${entry.amountCredits} MSN',
          style: TextStyle(
            color: u.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

