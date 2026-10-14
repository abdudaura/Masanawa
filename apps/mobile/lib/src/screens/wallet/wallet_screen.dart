import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../commerce/wallet_models.dart';
import '../../finance/crypto_wallet_screen.dart';
import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../finance/msn_balance_card.dart';
import '../../finance/msn_balance_transport.dart';
import '../../finance/msn_funding_card.dart';
import '../../finance/msn_funding_transport.dart';
import '../../state/session_state.dart';
import 'send_credits_sheet.dart';
import 'wallet_receipt_sheet.dart';
import '../../state/wallet_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../ui/components/masanawa_main_header.dart';

/// Compile-time rollout gate. Production APKs never expose Credits Send
/// until Gateway policy, real-account ledger replay and device checks qualify.
const bool kWalletCreditSendEnabled = bool.fromEnvironment(
  'MASANAWA_WALLET_CREDIT_SEND_ENABLED', defaultValue: false,
);

/// Exact MSN uses its own off-chain asset, not existing Credits.
/// Production Wallet does not reveal this until qualified and enabled.
const bool kWalletMsnBalanceEnabled = bool.fromEnvironment(
  'MASANAWA_MSN_BALANCE_ENABLED', defaultValue: false,
);

/// Independent, read-only quote/status rollout. Defaults OFF until staged
/// finance schema, provider/custody and operator release checks qualify.
const bool kWalletMsnFundingStatusEnabled = bool.fromEnvironment(
  'MASANAWA_MSN_FUNDING_READBACK_ENABLED', defaultValue: false,
);

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
    this.walletCreditSendEnabled = kWalletCreditSendEnabled,
    this.walletMsnBalanceEnabled = kWalletMsnBalanceEnabled,
    this.walletMsnFundingStatusEnabled = kWalletMsnFundingStatusEnabled,
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
  final bool walletCreditSendEnabled;
  final bool walletMsnBalanceEnabled;
  final bool walletMsnFundingStatusEnabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final wallet = ref.watch(walletProvider);
    final accountId = (walletCreditSendEnabled || walletMsnBalanceEnabled ||
            walletMsnFundingStatusEnabled)
        ? switch (ref.watch(sessionProvider)) {
            SessionSignedIn(:final user) => user.id,
            _ => null,
          }
        : null;

    // Loading or a balance failure must not remove entry to separate,
    // independently qualified Billing/Crypto routes.
    Widget pendingOrUnavailableWallet({bool loading = false}) => ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [

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

    return DefaultTabController(
      length: 2,
      child: Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: embeddedInShell ? null : masanawaMainHeader(context),
      body: Column(children: [
        const TabBar(
          tabs: [
            Tab(text: 'Balance'),
            Tab(text: 'Crypto'),
          ],
        ),
        Expanded(child: TabBarView(children: [
      RefreshIndicator(
        onRefresh: () => ref.read(walletProvider.notifier).refresh(),
        child: wallet.when(
          skipLoadingOnRefresh: false,
          loading: () => pendingOrUnavailableWallet(loading: true),
          error: (_, _) => pendingOrUnavailableWallet(),
          data: (value) {
            if (value == null) return pendingOrUnavailableWallet();
            VoidCallback? sendAction = onSend;
            if (sendAction == null &&
                walletCreditSendEnabled &&
                accountId != null) {
              sendAction = () async {
                final receipt = await showModalBottomSheet<CreditTransferReceipt>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => SendCreditsSheet(
                    expectedAccountId: accountId,
                    currentAccountId: () => switch (ref.read(sessionProvider)) {
                      SessionSignedIn(:final user) => user.id,
                      _ => null,
                    },
                    spendableCredits: value.spendableCredits,
                    onSend: (recipient, amount) =>
                        ref.read(walletProvider.notifier).sendCredits(
                          recipient: recipient, amountCredits: amount,
                        ),
                  ),
                );
                if (!context.mounted || receipt == null) {
                  return;
                }
                final current = ref.read(sessionProvider);
                if (current is! SessionSignedIn ||
                    current.user.id != accountId) {
                  return;
                }
                await showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => WalletReceiptSheet(
                    title: 'Credits sent',
                    amountCredits: receipt.amountCredits,
                    reference: receipt.transferId,
                    detail: 'Sent to ${receipt.recipientUserId}.',
                  ),
                );
              };
            }
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                _Balances(view: value),
                if (walletMsnBalanceEnabled && accountId != null)
                  MsnBalanceCard(
                    sessionIdentity: accountId,
                    transport: GatewayMsnBalanceTransport(
                      dio: ref.watch(dioProvider),
                      baseUrl: kApiBaseUrl,
                      readAccessToken: () => ref.read(apiClientProvider).accessToken,
                    ),
                  ),
                if (walletMsnFundingStatusEnabled && accountId != null)
                  MsnFundingCard(
                    sessionIdentity: accountId,
                    transport: GatewayMsnFundingTransport(
                      dio: ref.watch(dioProvider),
                      baseUrl: kApiBaseUrl,
                      readAccessToken: () => ref.read(apiClientProvider).accessToken,
                    ),
                  ),
                const SizedBox(height: 12),

                if (onAddMoney != null ||
                    sendAction != null ||
                    onWithdraw != null) ...[
                  const SizedBox(height: 12),
                  _Actions(
                    onAddMoney: onAddMoney,
                    onSend: sendAction,
                    onWithdraw: onWithdraw,
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
                  ...value.entries.map(
                    (entry) => Column(
                      children: [
                        _WalletEntryTile(entry: entry),
                        Divider(height: 1, color: u.structuralBorder),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ),
      const CryptoWalletScreen(embeddedInWallet: true),
        ])),
      ]),
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Spendable Credits', style: TextStyle(color: u.textMuted)),
          const SizedBox(height: 4),
          Text(
            '${view.spendableCredits} Cr',
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _SmallBalance(
                label: 'Pending',
                value: '${view.pendingEarningsCredits} Cr',
              ),
              _SmallBalance(
                label: 'Available',
                value: '${view.availableEarningsCredits} Cr',
              ),
            ],
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
        Text(
          value,
          style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: u.textMuted, fontSize: 12)),
      ],
    );
  }
}

/// Shared service links remain navigation-only until the private durable
/// voice-first financial task contract is integrated (R06/R07).
/// Legacy compatibility widget. Bill-payment controls are intentionally
/// absent from Wallet; data bundles live in the conversation header.
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
  Widget build(BuildContext context) => const SizedBox.shrink();
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
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (onAddMoney != null)
          FilledButton.icon(
            onPressed: onAddMoney,
            icon: const Icon(Icons.add),
            label: const Text('Add money'),
          ),
        if (onSend != null)
          OutlinedButton.icon(
            onPressed: onSend,
            icon: const Icon(Icons.send_outlined),
            label: const Text('Send'),
          ),
        if (onWithdraw != null)
          IconButton.outlined(
            tooltip: 'Withdraw',
            onPressed: onWithdraw,
            icon: const Icon(Icons.south_west),
          ),
      ],
    );
  }
}

class _WalletEntryTile extends StatelessWidget {
  const _WalletEntryTile({required this.entry});
  final WalletEntry entry;

  IconData get icon {
    switch (entry.kind) {
      case WalletEntryKind.funding:
        return Icons.add_circle_outline;
      case WalletEntryKind.transferSent:
        return Icons.north_east;
      case WalletEntryKind.transferReceived:
        return Icons.south_west;
      case WalletEntryKind.purchase:
        return Icons.shopping_bag_outlined;
      case WalletEntryKind.commission:
        return Icons.percent;
      case WalletEntryKind.gift:
        return Icons.card_giftcard_outlined;
      case WalletEntryKind.voice:
        return Icons.graphic_eq;
      case WalletEntryKind.ownerSession:
        return Icons.person_outline;
      case WalletEntryKind.refund:
        return Icons.replay_outlined;
      case WalletEntryKind.withdrawal:
        return Icons.account_balance_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final sign = entry.incoming ? '+' : '-';
    final date = entry.createdAt;
    final months = MaterialLocalizations.of(context).formatShortMonthDay(date);
    final time =
        '${date.hour.toString().padLeft(2, '0')}:'
        '${date.minute.toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: u.brand, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  style: TextStyle(color: u.textPrimary, fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(
                  '$months ${date.year} · $time',
                  style: TextStyle(color: u.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  '$sign${entry.amountCredits} Cr',
                  style: TextStyle(
                    color: u.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
