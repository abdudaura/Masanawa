import 'package:flutter/material.dart';

/// Standalone crypto-first presentation to be mounted by the F12 Wallet owner
/// after the authenticated MSN backend is composed. Values must originate in
/// the canonical server; this widget does not invent an exchange rate or
/// silently rename existing Credits/creator earnings as MSN.
class MsnCryptoHolding {
  const MsnCryptoHolding({
    required this.asset,
    required this.network,
    required this.available,
  });

  final String asset;
  final String network;
  /// Exact provider string, never parsed through double arithmetic.
  final String available;
}

class MsnWalletPanel extends StatelessWidget {
  const MsnWalletPanel({
    super.key,
    required this.crypto,
    required this.msnExactAmount,
    required this.onOpenCrypto,
    this.onViewNgnFundingQuote,
    this.loading = false,
    this.error,
    this.onRetry,
    this.offline = false,
  });

  final List<MsnCryptoHolding> crypto;
  /// Null means unavailable / no authenticated MSN read, NOT zero.
  final String? msnExactAmount;
  final VoidCallback onOpenCrypto;
  final VoidCallback? onViewNgnFundingQuote;
  final bool loading;
  final bool offline;
  final String? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = theme.textTheme.titleMedium;

    Widget card(Widget child) => Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        card(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.currency_bitcoin),
              const SizedBox(width: 10),
              Text('Crypto holdings', style: label),
            ]),
            const SizedBox(height: 12),
            if (loading)
              const Center(child: CircularProgressIndicator())
            else if (error != null || offline)
              Text(offline
                ? 'Offline. Balances need a fresh server connection.'
                : 'Crypto balances are unavailable. No value has been assumed.')
            else if (crypto.isEmpty)
              const Text('No qualified crypto assets to show.')
            else
              ...crypto.map((holding) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  Expanded(child: Text('${holding.asset} · ${holding.network}')),
                  Text(holding.available,
                    style: theme.textTheme.bodyLarge,
                    textAlign: TextAlign.end),
                ]),
              )),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: onOpenCrypto,
                icon: const Icon(Icons.open_in_new),
                label: const Text('Manage crypto'),
              ),
            ),
          ],
        )),
        card(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.account_balance_wallet_outlined),
              const SizedBox(width: 10),
              Text('MSN · Masanawa balance', style: label),
            ]),
            const SizedBox(height: 10),
            if (loading)
              const LinearProgressIndicator()
            else
              Text(
                (offline || error != null || msnExactAmount == null)
                    ? 'Balance unavailable'
                    : '$msnExactAmount MSN',
                style: theme.textTheme.headlineSmall,
              ),
            const SizedBox(height: 8),
            const Text('Platform units are separate from cryptocurrency and creator earnings.'),
          ],
        )),
        if (error != null && !offline)
          Text('Could not refresh wallet. Your balance has not been changed.',
            style: TextStyle(color: theme.colorScheme.error)),
        if ((error != null || offline) && onRetry != null)
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry balance'),
            ),
          ),
        if (onViewNgnFundingQuote != null)
          card(Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Fund with NGN', style: label),
              const SizedBox(height: 6),
              const Text('Nigeria only. Review a live MSN conversion quote, fees and amount before depositing. NGN is not a wallet balance.'),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: onViewNgnFundingQuote,
                child: const Text('View NGN to MSN quote'),
              ),
            ],
          )),
      ],
    );
  }
}
