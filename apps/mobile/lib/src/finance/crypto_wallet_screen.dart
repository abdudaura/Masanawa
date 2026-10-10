import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/network/api_client.dart';
import '../core/providers.dart';
import '../agents/masanawa_transport.dart';
import 'msn_balance_card.dart';
import 'msn_balance_transport.dart';
import '../core/request_id.dart';
import '../theme/masanawa_theme.dart';
import '../tokens/masanawa_tokens.dart';
import 'crypto_models.dart';
import 'crypto_state.dart';

class CryptoWalletScreen extends ConsumerWidget {
  const CryptoWalletScreen({super.key});

  static String operationTitle(String operation) {
    switch (operation) {
      case 'deposit':
        return 'Deposit';
      case 'withdraw':
        return 'Withdrawal';
      case 'convert':
        return 'Conversion';
      case 'buy':
        return 'Buy';
      default:
        return 'Crypto operation';
    }
  }

  static void _message(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  static void _error(BuildContext context, Object error) {
    _message(
      context,
      error is ApiException
          ? error.message
          : error is FormatException
              ? 'Please check the amount and details you entered.'
              : 'Crypto service is temporarily unavailable. Please try again.',
    );
  }

  Future<void> _buy(
    BuildContext context,
    WidgetRef ref,
    CryptoWalletSnapshot wallet,
  ) async {
    final capabilities = wallet.capabilities;
    final settlement = capabilities.fiatSettlementProviderCode;
    if (
      !capabilities.fiatOnRamp ||
      capabilities.fiatCurrencies.isEmpty ||
      settlement == null
    ) {
      return;
    }

    final input = await showModalBottomSheet<_BuyInput>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _BuySheet(
        fiatCurrencies: capabilities.fiatCurrencies,
        settlementAsset: settlement,
      ),
    );
    if (input == null || !context.mounted) return;

    try {
      final purchase =
          await ref.read(cryptoWalletProvider.notifier).createFiatPurchase(
                requestId: createRequestId(),
                fiatAmount: input.amount,
                fiatCurrency: input.currency,
              );
      final checkout = purchase.checkoutUrl == null
          ? null
          : Uri.tryParse(purchase.checkoutUrl!);
      if (
        checkout == null ||
        checkout.scheme != 'https' ||
        checkout.host.isEmpty
      ) {
        throw const FormatException('Secure checkout is unavailable');
      }
      final opened = await launchUrl(
        checkout,
        mode: LaunchMode.externalApplication,
      );
      if (!context.mounted) return;
      if (!opened) {
        _message(
          context,
          'The secure checkout could not be opened. Your purchase was not duplicated; open Wallet activity to try status refresh.',
        );
        return;
      }
      final checkStatus = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Checkout opened'),
          content: Text(
            'Complete the secure checkout, then return here. '
            'Masanawa credits only the exact ${purchase.settlementAsset} amount '
            'confirmed by the payment provider.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Later'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Check status'),
            ),
          ],
        ),
      );
      if (checkStatus == true && context.mounted) {
        final refreshed = await ref
            .read(cryptoWalletProvider.notifier)
            .refreshFiatPurchase(purchase.requestId);
        if (!context.mounted) return;
        final message = refreshed.status == 'succeeded' &&
                refreshed.cryptoAmount != null
            ? 'Purchase completed: ${refreshed.cryptoAmount} ${refreshed.settlementAsset}'
            : 'Purchase status: ${refreshed.status.replaceAll('_', ' ')}';
        _message(context, message);
      }
    } catch (error) {
      if (context.mounted) _error(context, error);
    }
  }

  Future<void> _receive(
    BuildContext context,
    WidgetRef ref,
    CryptoWalletSnapshot wallet,
  ) async {
    final route = wallet.selectedRoute;
    if (route == null) return;
    final input = await showModalBottomSheet<_ReceiveInput>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ReceiveSheet(route: route),
    );
    if (input == null || !context.mounted) return;
    try {
      final intent = await ref.read(cryptoWalletProvider.notifier).createDeposit(
            requestId: createRequestId(),
            providerCode: route.providerCode,
            amount: input.amount,
          );
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => _DepositDialog(intent: intent),
      );
    } catch (error) {
      if (context.mounted) _error(context, error);
    }
  }

  Future<void> _convert(
    BuildContext context,
    WidgetRef ref,
    CryptoWalletSnapshot wallet,
  ) async {
    final source = wallet.selectedRoute;
    if (source == null || !wallet.capabilities.conversions) return;
    final targets = wallet.conversionRoutes
        .where((route) => route.providerCode != source.providerCode)
        .toList(growable: false);
    if (targets.isEmpty) {
      _message(context, 'No conversion destination is available right now.');
      return;
    }
    final input = await showModalBottomSheet<_ConvertInput>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ConvertSheet(source: source, targets: targets),
    );
    if (input == null || !context.mounted) return;

    try {
      final controller = ref.read(cryptoWalletProvider.notifier);
      final quote = await controller.quoteConversion(
        providerCode: source.providerCode,
        targetProviderCode: input.targetProviderCode,
        amount: input.amount,
      );
      if (!context.mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Confirm conversion'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SummaryRow(
                label: 'You convert',
                value: '${quote.amount} ${quote.providerCode}',
              ),
              _SummaryRow(
                label: 'Estimated receive',
                value:
                    '${quote.estimatedTargetAmount} ${quote.targetProviderCode}',
              ),
              _SummaryRow(
                label: 'Provider minimum',
                value: '${quote.minimumAmount} ${quote.providerCode}',
              ),
              const SizedBox(height: 8),
              const Text(
                'The final credited amount comes from provider settlement evidence, not the estimate.',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Convert'),
            ),
          ],
        ),
      );
      if (confirmed != true || !context.mounted) return;
      final intent = await controller.createConversion(
        requestId: createRequestId(),
        providerCode: source.providerCode,
        targetProviderCode: input.targetProviderCode,
        amount: input.amount,
      );
      if (context.mounted) _operationResult(context, intent);
    } catch (error) {
      if (context.mounted) _error(context, error);
    }
  }

  Future<void> _withdraw(
    BuildContext context,
    WidgetRef ref,
    CryptoWalletSnapshot wallet,
  ) async {
    final route = wallet.selectedRoute;
    if (route == null || !wallet.capabilities.withdrawals) return;
    final input = await showModalBottomSheet<_WithdrawInput>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _WithdrawSheet(route: route),
    );
    if (input == null || !context.mounted) return;

    try {
      final controller = ref.read(cryptoWalletProvider.notifier);
      final quote = await controller.quoteWithdrawal(
        providerCode: route.providerCode,
        amount: input.amount,
        destinationAddress: input.address,
      );
      if (!context.mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Confirm withdrawal'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SummaryRow(
                label: 'Amount',
                value: '${quote.amount} ${quote.providerCode}',
              ),
              _SummaryRow(
                label: 'Network fee estimate',
                value: '${quote.networkFee} ${quote.providerCode}',
              ),
              _SummaryRow(
                label: 'Estimated receive',
                value:
                    '${quote.estimatedReceiveAmount} ${quote.providerCode}',
              ),
              _SummaryRow(
                label: 'Fee handling',
                value: quote.networkFeeMode == 'sender'
                    ? 'Masanawa pays the network fee'
                    : 'Fee is deducted from the payout',
              ),
              _SummaryRow(
                label: 'Provider minimum',
                value: '${quote.minimumAmount} ${quote.providerCode}',
              ),
              const SizedBox(height: 8),
              SelectableText(
                quote.destinationAddress,
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Withdraw'),
            ),
          ],
        ),
      );
      if (confirmed != true || !context.mounted) return;
      final intent = await controller.createWithdrawal(
        requestId: createRequestId(),
        providerCode: route.providerCode,
        amount: input.amount,
        destinationAddress: input.address,
      );
      if (context.mounted) _operationResult(context, intent);
    } catch (error) {
      if (context.mounted) _error(context, error);
    }
  }

  Future<void> _refreshIntent(
    BuildContext context,
    WidgetRef ref,
    CryptoIntent intent,
  ) async {
    try {
      final refreshed =
          await ref.read(cryptoWalletProvider.notifier).refreshOperation(intent);
      if (context.mounted && refreshed.terminal) {
        _operationResult(context, refreshed);
      }
    } catch (error) {
      if (context.mounted) _error(context, error);
    }
  }

  void _operationResult(BuildContext context, CryptoIntent intent) {
    final message = switch (intent.status) {
      'succeeded' when intent.operation == 'convert' =>
        intent.providerTargetAmount == null
            ? 'Conversion completed'
            : 'Conversion completed: ${intent.providerTargetAmount} ${intent.targetAsset}',
      'succeeded' when intent.operation == 'buy' =>
        intent.providerTargetAmount == null
            ? 'Crypto purchase completed'
            : 'Purchase completed: ${intent.providerTargetAmount} ${intent.targetAsset}',
      'manual_review' =>
        'This transaction needs verification before any balance change is accepted.',
      'succeeded' => '${operationTitle(intent.operation)} completed',
      'failed' =>
        '${operationTitle(intent.operation)} failed. Reserved funds were released when applicable.',
      _ =>
        '${operationTitle(intent.operation)} submitted. It will update after provider confirmation.',
    };
    _message(context, message);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(cryptoWalletProvider);
    final sessionClient = ref.watch(apiClientProvider);
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Crypto Wallet'),
        actions: [
          IconButton(
            tooltip: 'Refresh wallet',
            onPressed: () => ref.read(cryptoWalletProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: wallet.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _WalletError(
          error: error,
          onRetry: () => ref.read(cryptoWalletProvider.notifier).refresh(),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.read(cryptoWalletProvider.notifier).refresh(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              _CryptoTokenStrip(
                wallet: data,
                onSelected: (value) {
                  ref.read(cryptoWalletProvider.notifier).selectAsset(value);
                },
              ),
              const SizedBox(height: 10),
              _BalanceCard(
                wallet: data,
                onRefreshBalance: data.selectedProviderCode == null
                    ? null
                    : () =>
                        ref.read(cryptoWalletProvider.notifier).refreshBalance(),
              ),
              const SizedBox(height: 10),
              MsnBalanceCard(
                sessionIdentity: sessionClient.accessToken,
                transport: GatewayMsnBalanceTransport(
                  dio: sessionClient.dio,
                  baseUrl: kAgentBaseUrl,
                  readAccessToken: () => ref.read(apiClientProvider).accessToken,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.add_card_rounded,
                      label: 'Buy',
                      enabled: data.capabilities.fiatOnRamp &&
                          data.capabilities.fiatCurrencies.isNotEmpty &&
                          data.capabilities.fiatSettlementProviderCode != null,
                      onTap: () => _buy(context, ref, data),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.call_received_rounded,
                      label: 'Receive',
                      enabled:
                          data.capabilities.deposits && data.selectedRoute != null,
                      onTap: () => _receive(context, ref, data),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.swap_horiz_rounded,
                      label: 'Convert',
                      enabled: data.capabilities.conversions &&
                          data.selectedRoute != null,
                      onTap: () => _convert(context, ref, data),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.call_made_rounded,
                      label: 'Withdraw',
                      enabled: data.capabilities.withdrawals &&
                          data.selectedRoute != null,
                      onTap: () => _withdraw(context, ref, data),
                    ),
                  ),
                ],
              ),
              if (!data.capabilities.fiatOnRamp ||
                  !data.capabilities.conversions ||
                  !data.capabilities.withdrawals) ...[
                const SizedBox(height: 14),
                _CapabilityNotice(capabilities: data.capabilities),
              ],
              const SizedBox(height: 22),
              Text(
                'Activity',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              if (data.history.isEmpty)
                _EmptyHistory(color: u.textMuted)
              else
                _HistoryCard(
                  history: data.history,
                  onRefresh: (intent) => _refreshIntent(context, ref, intent),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CryptoTokenStrip extends StatelessWidget {
  const _CryptoTokenStrip({
    required this.wallet,
    required this.onSelected,
  });

  final CryptoWalletSnapshot wallet;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    if (wallet.depositRoutes.isEmpty) return const SizedBox.shrink();
    return Center(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final route in wallet.depositRoutes) ...[
              ChoiceChip(
                label: Text(route.label),
                selected: wallet.selectedProviderCode == route.providerCode,
                showCheckmark: false,
                visualDensity: VisualDensity.compact,
                onSelected: (_) => onSelected(route.providerCode),
              ),
              const SizedBox(width: 6),
            ],
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({
    required this.wallet,
    required this.onRefreshBalance,
  });

  final CryptoWalletSnapshot wallet;
  final VoidCallback? onRefreshBalance;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final selected = wallet.selectedRoute;
    final balance = wallet.selectedBalance;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [u.brandGradientFrom, u.brandGradientTo],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['2xl']!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Available balance',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  selected == null ? 'No assets' : balance ?? '—',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 31,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (selected != null)
                IconButton(
                  tooltip: 'Refresh balance',
                  color: Colors.white,
                  onPressed: onRefreshBalance,
                  icon: const Icon(Icons.sync),
                ),
            ],
          ),
          if (selected != null)
            Text(
              selected.label,
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: enabled ? u.surfaceCard : u.surfaceMuted,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 15),
          child: Column(
            children: [
              Icon(icon, color: enabled ? u.brand : u.textMuted),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  color: enabled ? u.textPrimary : u.textMuted,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CapabilityNotice extends StatelessWidget {
  const _CapabilityNotice({required this.capabilities});
  final CryptoCapabilities capabilities;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final messages = <String>[
      if (!capabilities.fiatOnRamp)
        'Buy with fiat is not available until the provider on-ramp is activated.',
      if (!capabilities.conversions)
        'Conversions are not currently qualified for this account.',
      if (!capabilities.withdrawals)
        'Withdrawals are not currently qualified for this account.',
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: u.surfaceMuted,
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['lg']!),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, color: u.brand, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              messages.join(' '),
              style: TextStyle(color: u.textMuted, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.history, required this.onRefresh});
  final List<CryptoIntent> history;
  final ValueChanged<CryptoIntent> onRefresh;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Card(
      elevation: 0,
      color: u.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(MasanawaTokens.radius['xl']!),
        side: BorderSide(color: u.structuralBorder),
      ),
      child: Column(
        children: [
          for (var index = 0; index < history.length; index++) ...[
            _HistoryTile(intent: history[index], onRefresh: onRefresh),
            if (index != history.length - 1) const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.intent, required this.onRefresh});
  final CryptoIntent intent;
  final ValueChanged<CryptoIntent> onRefresh;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final statusColor = switch (intent.status) {
      'succeeded' => u.success,
      'failed' || 'expired' || 'refunded' => u.emergency,
      _ => u.warning,
    };
    final icon = switch (intent.operation) {
      'deposit' => Icons.call_received_rounded,
      'withdraw' => Icons.call_made_rounded,
      'convert' => Icons.swap_horiz_rounded,
      'buy' => Icons.add_card_rounded,
      _ => Icons.currency_bitcoin,
    };
    final showsTarget =
        (intent.operation == 'convert' || intent.operation == 'buy') &&
        intent.targetAsset != null;
    final amount = showsTarget
        ? intent.providerTargetAmount == null
            ? '${intent.amount} ${intent.asset} → ${intent.targetAsset}'
            : '${intent.amount} ${intent.asset} → ${intent.providerTargetAmount} ${intent.targetAsset}'
        : '${intent.amount} ${intent.asset}';

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: statusColor.withValues(alpha: .12),
        child: Icon(icon, color: statusColor),
      ),
      title: Text(
        CryptoWalletScreen.operationTitle(intent.operation),
        style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        '$amount\n${intent.status.replaceAll('_', ' ')}',
        maxLines: 2,
      ),
      isThreeLine: true,
      trailing: intent.pending &&
              (intent.operation == 'withdraw' ||
                  intent.operation == 'convert' ||
                  intent.operation == 'buy')
          ? IconButton(
              tooltip: 'Check status',
              onPressed: () => onRefresh(intent),
              icon: const Icon(Icons.refresh),
            )
          : Icon(Icons.circle, color: statusColor, size: 10),
    );
  }
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Center(
        child: Text('No crypto activity yet', style: TextStyle(color: color)),
      ),
    );
  }
}

class _WalletError extends StatelessWidget {
  const _WalletError({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final message =
        error is ApiException ? (error as ApiException).message : 'Wallet unavailable';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.account_balance_wallet_outlined, size: 48, color: u.brand),
            const SizedBox(height: 14),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DepositDialog extends StatelessWidget {
  const _DepositDialog({required this.intent});
  final CryptoIntent intent;

  @override
  Widget build(BuildContext context) {
    final address = intent.payAddress;
    final amount = intent.providerPayAmount ?? intent.amount;
    return AlertDialog(
      title: const Text('Receive crypto'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SummaryRow(label: 'Send exactly', value: '$amount ${intent.asset}'),
          const SizedBox(height: 12),
          const Text('Deposit address'),
          const SizedBox(height: 6),
          SelectableText(address ?? 'Address unavailable'),
          if (address != null) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: address));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Address copied')),
                  );
                }
              },
              icon: const Icon(Icons.copy),
              label: const Text('Copy address'),
            ),
          ],
          const SizedBox(height: 10),
          const Text(
            'Send only the selected asset and network to this address. The balance updates after provider confirmation.',
          ),
        ],
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Done'),
        ),
      ],
    );
  }
}

class _BuySheet extends StatefulWidget {
  const _BuySheet({
    required this.fiatCurrencies,
    required this.settlementAsset,
  });

  final List<String> fiatCurrencies;
  final String settlementAsset;

  @override
  State<_BuySheet> createState() => _BuySheetState();
}

class _BuySheetState extends State<_BuySheet> {
  final _amount = TextEditingController();
  late String _currency;

  @override
  void initState() {
    super.initState();
    _currency = widget.fiatCurrencies.first;
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Buy crypto',
      children: [
        DropdownButtonFormField<String>(
          value: _currency,
          decoration: const InputDecoration(labelText: 'Pay with'),
          items: [
            for (final currency in widget.fiatCurrencies)
              DropdownMenuItem(value: currency, child: Text(currency)),
          ],
          onChanged: (value) {
            if (value != null) setState(() => _currency = value);
          },
        ),
        const SizedBox(height: 12),
        _AmountField(
          controller: _amount,
          label: 'Fiat amount',
        ),
        const SizedBox(height: 12),
        Text(
          'Your purchase settles as ${widget.settlementAsset} in your Masanawa wallet. You can convert it after settlement.',
        ),
        const SizedBox(height: 8),
        const Text(
          'The secure payment partner may require identity verification before accepting a fiat purchase.',
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () {
            final amount = _validAmount(_amount.text, maxDecimals: 2);
            if (amount != null) {
              Navigator.pop(context, _BuyInput(_currency, amount));
            }
          },
          icon: const Icon(Icons.open_in_new),
          label: const Text('Continue to secure checkout'),
        ),
      ],
    );
  }
}

class _ReceiveSheet extends StatefulWidget {
  const _ReceiveSheet({required this.route});
  final CryptoRoute route;

  @override
  State<_ReceiveSheet> createState() => _ReceiveSheetState();
}

class _ReceiveSheetState extends State<_ReceiveSheet> {
  final _amount = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Receive ${widget.route.asset}',
      children: [
        Text('${widget.route.label} deposit'),
        const SizedBox(height: 14),
        _AmountField(controller: _amount),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () {
            final value = _validAmount(_amount.text);
            if (value != null) Navigator.pop(context, _ReceiveInput(value));
          },
          child: const Text('Create deposit address'),
        ),
      ],
    );
  }
}

class _ConvertSheet extends StatefulWidget {
  const _ConvertSheet({required this.source, required this.targets});
  final CryptoRoute source;
  final List<CryptoRoute> targets;

  @override
  State<_ConvertSheet> createState() => _ConvertSheetState();
}

class _ConvertSheetState extends State<_ConvertSheet> {
  final _amount = TextEditingController();
  late String _target;

  @override
  void initState() {
    super.initState();
    _target = widget.targets.first.providerCode;
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Convert ${widget.source.asset}',
      children: [
        _AmountField(controller: _amount),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: _target,
          decoration: const InputDecoration(labelText: 'Convert to'),
          items: [
            for (final route in widget.targets)
              DropdownMenuItem(
                value: route.providerCode,
                child: Text(route.label),
              ),
          ],
          onChanged: (value) {
            if (value != null) setState(() => _target = value);
          },
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () {
            final value = _validAmount(_amount.text);
            if (value != null) {
              Navigator.pop(context, _ConvertInput(_target, value));
            }
          },
          child: const Text('Review quote'),
        ),
      ],
    );
  }
}

class _WithdrawSheet extends StatefulWidget {
  const _WithdrawSheet({required this.route});
  final CryptoRoute route;

  @override
  State<_WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends State<_WithdrawSheet> {
  final _amount = TextEditingController();
  final _address = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Withdraw ${widget.route.asset}',
      children: [
        _AmountField(controller: _amount),
        const SizedBox(height: 12),
        TextField(
          controller: _address,
          minLines: 1,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Destination address'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () {
            final amount = _validAmount(_amount.text);
            final address = _address.text.trim();
            if (amount != null && address.isNotEmpty && address.length <= 512) {
              Navigator.pop(context, _WithdrawInput(amount, address));
            }
          },
          child: const Text('Review fee'),
        ),
      ],
    );
  }
}

class _SheetScaffold extends StatelessWidget {
  const _SheetScaffold({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

class _AmountField extends StatelessWidget {
  const _AmountField({
    required this.controller,
    this.label = 'Amount',
  });
  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
      ],
      decoration: InputDecoration(labelText: label, hintText: '0.00'),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: TextStyle(color: u.textMuted))),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: u.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String? _validAmount(String raw, {int maxDecimals = 18}) {
  final value = raw.trim();
  final match = RegExp(r'^(?:0|[1-9]\d*)(?:\.(\d+))?$').firstMatch(value);
  if (match == null || (match.group(1)?.length ?? 0) > maxDecimals) {
    return null;
  }
  final number = num.tryParse(value);
  return number == null || number <= 0 ? null : value;
}

class _BuyInput {
  const _BuyInput(this.currency, this.amount);
  final String currency;
  final String amount;
}

class _ReceiveInput {
  const _ReceiveInput(this.amount);
  final String amount;
}

class _ConvertInput {
  const _ConvertInput(this.targetProviderCode, this.amount);
  final String targetProviderCode;
  final String amount;
}

class _WithdrawInput {
  const _WithdrawInput(this.amount, this.address);
  final String amount;
  final String address;
}
