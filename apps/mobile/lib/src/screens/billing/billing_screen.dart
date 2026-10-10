import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../l10n/app_localizations.dart';
import '../../core/api/billing_models.dart';
import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../state/wallet_state.dart';

BillCategory? billingCategoryForHomeService(
  List<BillCategory> categories,
  String? service,
) {
  final initial = service?.trim().toLowerCase();
  if (initial == null || initial.isEmpty) return null;
  final terms = switch (initial) {
    'data' => const ['data', 'internet'],
    'airtime' => const ['airtime', 'air time', 'mobile recharge'],
    'electricity' => const ['electricity', 'power'],
    'tv' => const ['tv', 'cable', 'television'],
    _ => <String>[initial],
  };
  for (final value in categories) {
    final haystack = (value.code + ' ' + value.name).toLowerCase();
    if (terms.any(haystack.contains)) return value;
  }
  return null;
}

/// Map only known authoritative quote phases to localized status labels.
/// Never infer financial success from a client action or unknown state.
String billingStatusLabel(String state, AppLocalizations l) => switch (state) {
  'quoted' => l.billingStatusQuoted,
  'checkout-created' || 'awaiting' => l.billingStatusAwaiting,
  'awaiting-funds' => l.billingStatusAwaitingFunds,
  'funded' => l.billingStatusFunded,
  'reserved' || 'processing' || 'pending' => l.billingStatusProcessing,
  'succeeded' || 'fulfilled' => l.billingStatusCompleted,
  'refund-pending' || 'refund-dispatching' || 'refund-submitted' => l.billingStatusRefundProcessing,
  'refunded' => l.billingStatusRefunded,
  'expired' => l.billingStatusExpired,
  'failed' => l.billingStatusFailed,
  _ => l.billingStatusUnknown,
};

class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key, this.initialService});

  final String? initialService;

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> {
  final customer = TextEditingController();
  final amount = TextEditingController();

  List<BillCategory> categories = const [];
  List<BillBiller> billers = const [];
  List<BillItem> items = const [];
  List<BillingCheckoutView> history = const [];
  BillCategory? category;
  BillBiller? biller;
  BillItem? item;
  BillingCheckoutView? current;
  BillingWalletActionView? walletAction;
  bool busy = false;
  bool loading = true;
  String? error;
  Timer? _fundingExpiryTimer;
  int _selectionEpoch = 0;

  ApiClient get api => ref.read(apiClientProvider);
  AppLocalizations get l => AppLocalizations.of(context);

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    _fundingExpiryTimer?.cancel();
    customer.dispose();
    amount.dispose();
    super.dispose();
  }

  // Do not surface untrusted provider text or internal exception details.
  // Only recognized stable financial errors have localized recovery copy.
  String safeError(Object value, String fallback) {
    if (value is ApiException) {
      if (value.message == 'financial.auth.unauthorized' ||
          value.message == 'UNAUTHORIZED') return l.billingSignInAgain;
      if (value.message.contains('quote_expired')) return l.billingExpiredTryAgain;
    }
    return fallback;
  }

  Future<void> load() async {
    if (mounted) setState(() { loading = true; error = null; });
    try {
      final nextCategories = await api.billingCategories();
      final nextHistory = await api.billingHistory(limit: 30);
      if (!mounted) return;
      setState(() {
        categories = nextCategories;
        history = nextHistory;
        loading = false;
      });
      if (category == null) {
        final matched =
            billingCategoryForHomeService(nextCategories, widget.initialService);
        if (matched != null) await selectCategory(matched);
      }
    } catch (value) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = safeError(value, l.billingUnavailable);
      });
    }
  }

  Future<void> selectCategory(BillCategory? value) async {
    if (value == null || busy) return;
    setState(() {
      category = value;
      biller = null;
      item = null;
      billers = const [];
      items = const [];
      customer.clear();
      amount.clear();
      busy = true;
      error = null;
    });
    try {
      final next = await api.billingBillers(value.code);
      if (mounted) setState(() => billers = next);
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, l.billingProvidersUnavailable));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> selectBiller(BillBiller? value) async {
    if (value == null || busy) return;
    setState(() {
      biller = value;
      item = null;
      items = const [];
      customer.clear();
      amount.clear();
      busy = true;
      error = null;
    });
    try {
      final next = await api.billingItems(value.billerCode);
      if (mounted) setState(() => items = next);
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, l.billingServicesUnavailable));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void selectItem(BillItem? value) {
    if (value == null || busy) return;
    setState(() {
      item = value;
      customer.clear();
      amount.text = value.variableAmount ? '' : value.amount;
      error = null;
    });
  }

  Future<void> createQuote() async {
    ++_selectionEpoch;
    _fundingExpiryTimer?.cancel();
    final selectedCategory = category;
    final selectedBiller = biller;
    final selectedItem = item;
    final recipient = customer.text.trim();
    final rawAmount = amount.text.trim();
    if (selectedCategory == null || selectedBiller == null || selectedItem == null) {
      setState(() => error = l.billingSelectionRequired);
      return;
    }
    if (recipient.isEmpty || (num.tryParse(rawAmount) ?? 0) <= 0) {
      setState(() => error = l.billingInvalidDetails);
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      final view = await api.createBillingQuote(
        categoryCode: selectedCategory.code,
        billerCode: selectedBiller.billerCode,
        itemCode: selectedItem.itemCode,
        customerId: recipient,
        amount: rawAmount,
      );
      if (mounted) setState(() => current = view);
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, l.billingQuoteFailed));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> confirmFromWallet() async {
    final view = current;
    if (view == null) return;
    setState(() { busy = true; error = null; });
    try {
      final next = await api.confirmBillingFromWallet(
        quoteId: view.quote.quoteId,
        quoteRevision: view.quote.revision,
      );
      if (!mounted) return;
      setState(() => walletAction = next);
      _scheduleFundingExpiry();
      await ref.read(walletProvider.notifier).refresh();
      // The immediate wallet response owns fresh bank details; refreshing the
      // quote must not discard it while the status endpoint is unavailable.
      await refreshCurrent(silent: true, restoreFunding: false);
    } catch (value) {
      if (mounted) {
        setState(() => error = safeError(
          value,
          l.billingPurchaseFailed,
        ));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
  Future<void> refreshCurrent({
    bool silent = false,
    bool restoreFunding = true,
  }) async {
    final view = current;
    if (view == null) return;
    if (!silent) setState(() { busy = true; error = null; });
    try {
      await readOwnedBill(view.quote.quoteId, restoreFunding: restoreFunding);
      await reloadHistory();
    } catch (value) {
      if (mounted) {
        setState(() => error = safeError(
          value, l.billingRefreshFailed,
        ));
      }
    } finally {
      if (!silent && mounted) setState(() => busy = false);
    }
  }

  /// Restores bank instructions only from an authenticated, authoritative
  /// owner-scoped read. No confirmation, virtual account creation or payment.
  Future<void> readOwnedBill(String quoteId, {
    bool restoreFunding = true,
  }) async {
    final capturedEpoch = _selectionEpoch;
    // Clear before the first network await, including when the quote GET
    // fails. Displaying a stale account after authentication failure is unsafe.
    if (restoreFunding && mounted) setState(() => walletAction = null);
    final detail = await api.billingQuote(quoteId);
    final status = restoreFunding && !detail.isTerminal
        ? await api.billingWalletStatus(quoteId)
        : null;
    if (!mounted || capturedEpoch != _selectionEpoch) return;
    setState(() {
      current = detail;
      if (restoreFunding || detail.isTerminal) walletAction = status;
    });
    _scheduleFundingExpiry();
  }

  void _scheduleFundingExpiry() {
    _fundingExpiryTimer?.cancel();
    final funding = walletAction?.funding;
    final quote = current?.quote;
    if (funding == null || quote == null) return;
    final fundingExpiry = DateTime.tryParse(funding.expiresAt);
    final quoteExpiry = DateTime.tryParse(quote.expiresAt);
    if (fundingExpiry == null || quoteExpiry == null) return;
    final deadline = fundingExpiry.isBefore(quoteExpiry)
        ? fundingExpiry : quoteExpiry;
    final remaining = deadline.difference(DateTime.now());
    if (remaining <= Duration.zero) {
      setState(() => walletAction = null);
      return;
    }
    // Stop rendering bank coordinates the moment either authority expires,
    // even if the user leaves the same screen open without interacting.
    _fundingExpiryTimer = Timer(remaining + const Duration(milliseconds: 10), () {
      if (!mounted) return;
      setState(() => walletAction = null);
      unawaited(refreshCurrent(silent: true));
    });
  }

  Future<void> reloadHistory() async {
    try {
      final next = await api.billingHistory(limit: 30);
      if (mounted) setState(() => history = next);
    } catch (_) {}
  }

  Future<void> restore(BillingCheckoutView entry) async {
    ++_selectionEpoch;
    _fundingExpiryTimer?.cancel();
    setState(() { busy = true; error = null; });
    try {
      await readOwnedBill(entry.quote.quoteId);
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, l.billingDetailsFailed));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void newBill() {
    ++_selectionEpoch;
    setState(() {
      current = null;
      category = null;
      biller = null;
      item = null;
      billers = const [];
      items = const [];
      customer.clear();
      amount.clear();
      walletAction = null;
      error = null;
    });
    _fundingExpiryTimer?.cancel();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(strings.billingTitle),
        actions: [
          if (current != null)
            IconButton(
              tooltip: strings.billingNew,
              onPressed: busy ? null : newBill,
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await load();
          if (current != null) await refreshCurrent(silent: true);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            if (loading) const LinearProgressIndicator(minHeight: 2),
            if (error != null) ...[
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(error!),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (current == null)
              buildForm()
            else
              buildTransaction(current!),
            const SizedBox(height: 28),
            Row(
              children: [
                Text(strings.billingRecent, style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  tooltip: strings.billingRefreshHistory,
                  onPressed: busy ? null : reloadHistory,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            if (history.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 28),
                child: Center(child: Text(strings.billingNoPayments)),
              )
            else
              for (final entry in history)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.receipt_long_outlined),
                    title: Text(entry.quote.itemName),
                    subtitle: Text(
                      entry.quote.customerId + ' · ' + billingStatusLabel(entry.quote.state, strings),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Text('₦' + entry.quote.totalAmount),
                    onTap: busy ? null : () => restore(entry),
                  ),
                ),
          ],
        ),
      ),
    );
  }

  Widget buildForm() {
    final selectedItem = item;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.billingPayTitle, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        DropdownButtonFormField<BillCategory>(
          value: category,
          decoration: InputDecoration(labelText: l.billingCategory),
          items: categories.map((value) => DropdownMenuItem(
            value: value,
            child: Text(value.name),
          )).toList(growable: false),
          onChanged: busy ? null : selectCategory,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<BillBiller>(
          value: biller,
          decoration: InputDecoration(labelText: l.billingProvider),
          items: billers.map((value) => DropdownMenuItem(
            value: value,
            child: Text(value.name),
          )).toList(growable: false),
          onChanged: busy || billers.isEmpty ? null : selectBiller,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<BillItem>(
          value: item,
          isExpanded: true,
          decoration: InputDecoration(labelText: l.billingService),
          items: items.map((value) => DropdownMenuItem(
            value: value,
            child: Text(
              value.variableAmount
                  ? value.name
                  : value.name + ' · ₦' + value.amount,
              overflow: TextOverflow.ellipsis,
            ),
          )).toList(growable: false),
          onChanged: busy || items.isEmpty ? null : selectItem,
        ),
        if (selectedItem != null) ...[
          const SizedBox(height: 12),
          TextField(
            controller: customer,
            decoration: InputDecoration(
              labelText: selectedItem.labelName?.trim().isNotEmpty == true
                  ? selectedItem.labelName
                  : (category?.code == 'AIRTIME' || category?.code == 'MOBILEDATA')
                      ? l.billingPhone
                      : l.billingRecipient,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amount,
            readOnly: !selectedItem.variableAmount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: l.billingAmount,
              helperText: selectedItem.variableAmount
                  ? l.billingVariableHelp
                  : l.billingFixedHelp,
            ),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: busy ? null : createQuote,
            icon: const Icon(Icons.receipt_long_outlined),
            label: Text(l.billingReview),
          ),
        ],
      ],
    );
  }

  Widget buildTransaction(BillingCheckoutView view) {
    final quote = view.quote;
    final walletPhase = walletAction?.phase;
    final quoteExpiry = DateTime.tryParse(quote.expiresAt);
    final quoteFresh = quoteExpiry != null && quoteExpiry.isAfter(DateTime.now());
    final candidate = walletAction?.funding;
    final expiry = DateTime.tryParse(candidate?.expiresAt ?? '');
    // A displayed virtual account must remain provider-bound and unexpired,
    // including while a user leaves this screen open beyond its validity.
    final funding = walletPhase == 'awaiting-funds' && quoteFresh &&
            expiry != null && expiry.isAfter(DateTime.now()) &&
            candidate != null && candidate.accountNumber.trim().isNotEmpty &&
            candidate.bankName.trim().isNotEmpty
        ? candidate
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BillDetails(view: view),
        if (view.phase == 'quoted' && quoteFresh &&
            (walletPhase == null || walletPhase == 'ready')) ...[
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy ? null : confirmFromWallet,
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: Text(l.billingConfirmWallet('₦' + quote.totalAmount)),
          ),
        ],
        if (view.phase == 'quoted' && !quoteFresh) ...[
          const SizedBox(height: 12),
          Card(child: Padding(padding: const EdgeInsets.all(14), child: Text(l.billingExpiredTryAgain))),
        ],
        if (funding != null) ...[
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.billingAddFunds('₦' + funding.amount), style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 6),
                  Text(l.billingTransferInstructions),
                  const SizedBox(height: 12),
                  SelectableText(funding.bankName, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  SelectableText(funding.accountNumber, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 6),
                  Text(l.billingExpires + ' ' + funding.expiresAt),
                ],
              ),
            ),
          ),
        ],
        if (walletPhase == 'processing') ...[
          const SizedBox(height: 12),
          const Card(child: Padding(
            padding: EdgeInsets.all(14),
            child: Text('Your transfer or bill is being verified. Refresh to check progress; do not send another payment.'),
          )),
        ],
        if (walletPhase == 'awaiting-funds' && funding == null) ...[
          const SizedBox(height: 12),
          const Card(child: Padding(
            padding: EdgeInsets.all(14),
            child: Text('The funding instructions are unavailable or expired. Refresh your status before transferring.'),
          )),
        ],
        if (walletPhase == 'fulfilled') ...[
          const SizedBox(height: 12),
          Card(child: Padding(padding: const EdgeInsets.all(14), child: Text(l.billingSuccess))),
        ],
        if (view.phase == 'processing' || walletPhase == 'processing' || walletPhase == 'awaiting-funds' || walletPhase == 'ready') ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : refreshCurrent,
            icon: const Icon(Icons.refresh),
            label: Text(l.billingRefresh),
          ),
        ],
        if (view.isTerminal || walletPhase == 'fulfilled' || walletPhase == 'failed') ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : newBill,
            icon: const Icon(Icons.add),
            label: Text(l.billingAnother),
          ),
        ],
      ],
    );
  }

}

class BillDetails extends StatelessWidget {
  const BillDetails({super.key, required this.view});
  final BillingCheckoutView view;

  @override
  Widget build(BuildContext context) {
    final strings = AppLocalizations.of(context);
    final quote = view.quote;
    final token = view.purchase?.deliveryCode?.trim();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(quote.itemName, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            line(strings.billingRecipientLabel, quote.customerId, identifier: true),
            line(strings.billingServiceAmountLabel, '₦' + quote.serviceAmount),
            line(strings.billingFeeLabel, '₦' + quote.feeAmount),
            const Divider(),
            line(strings.billingTotalLabel, '₦' + quote.totalAmount, strong: true),
            line(strings.billingStatusLabel, billingStatusLabel(view.phase, strings)),
            if (quote.billProviderReference != null)
              line(strings.billingProviderRef, quote.billProviderReference!, identifier: true),
            if (token != null && token.isNotEmpty) ...[
              const Divider(),
              Text(strings.billingTokenLabel),
              const SizedBox(height: 6),
              SelectableText(
                token,
                textDirection: TextDirection.ltr,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
            if (view.phase == 'refunded')
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(strings.billingRefundedInfo),
              ),
          ],
        ),
      ),
    );
  }

  Widget line(String label, String value, {bool strong = false, bool identifier = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 105, child: Text(label)),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.right,
                textDirection: identifier ? TextDirection.ltr : null,
                style: strong ? const TextStyle(fontWeight: FontWeight.w700) : null,
              ),
            ),
          ],
        ),
      );
}

