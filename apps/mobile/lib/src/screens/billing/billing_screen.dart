import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/billing_models.dart';
import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../state/wallet_state.dart';

bool isDataBundleBillCategory(BillCategory category) {
  final code = category.code.trim().toUpperCase();
  return code == 'MOBILEDATA' || code == 'MOBILE_DATA' ||
      code == 'MOBILE-DATA' || code == 'DATA' ||
      code == 'INTERNET' || code == 'INTERNET_DATA' ||
      code == 'INTERNET-DATA';
}

BillCategory? billingCategoryForHomeService(
  List<BillCategory> categories,
  String? service,
) {
  // Retired bill types do not reopen a checkout through a legacy deep link.
  if (service != null && service.toLowerCase() != 'data') return null;
  for (final category in categories) {
    if (isDataBundleBillCategory(category)) return category;
  }
  return null;
}

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

  ApiClient get api => ref.read(apiClientProvider);

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    customer.dispose();
    amount.dispose();
    super.dispose();
  }

  String safeError(Object value, String fallback) =>
      value is ApiException && value.message.trim().isNotEmpty
          ? value.message
          : fallback;

  Future<void> load() async {
    if (mounted) setState(() { loading = true; error = null; });
    try {
      final nextCategories = await api.billingCategories();
      final nextHistory = await api.billingHistory(limit: 30);
      if (!mounted) return;
      setState(() {
        categories = nextCategories.where(isDataBundleBillCategory).toList(growable: false);
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
        error = safeError(value, 'Billing is unavailable right now.');
      });
    }
  }

  Future<void> selectCategory(BillCategory? value) async {
    if (value == null || busy || !isDataBundleBillCategory(value)) return;
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
      if (mounted) setState(() => error = safeError(value, 'Could not load providers.'));
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
      if (mounted) setState(() => error = safeError(value, 'Could not load services.'));
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
    final selectedCategory = category;
    final selectedBiller = biller;
    final selectedItem = item;
    final recipient = customer.text.trim();
    final rawAmount = amount.text.trim();
    if (selectedCategory == null || !isDataBundleBillCategory(selectedCategory) ||
        selectedBiller == null || selectedItem == null) {
      setState(() => error = 'Choose a category, provider and service.');
      return;
    }
    if (recipient.isEmpty || (num.tryParse(rawAmount) ?? 0) <= 0) {
      setState(() => error = 'Enter valid recipient details and amount.');
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
      if (mounted) setState(() => error = safeError(value, 'Could not create this quote.'));
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
      await ref.read(walletProvider.notifier).refresh();
      await refreshCurrent(silent: true);
    } catch (value) {
      if (mounted) {
        setState(() => error = safeError(
          value,
          'Could not complete this purchase from your wallet.',
        ));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
  Future<void> refreshCurrent({bool silent = false}) async {
    final view = current;
    if (view == null) return;
    if (!silent) setState(() { busy = true; error = null; });
    try {
      final next = await api.billingQuote(view.quote.quoteId);
      if (mounted) setState(() => current = next);
      await reloadHistory();
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, 'Could not refresh status.'));
    } finally {
      if (!silent && mounted) setState(() => busy = false);
    }
  }

  Future<void> reloadHistory() async {
    try {
      final next = await api.billingHistory(limit: 30);
      if (mounted) setState(() => history = next);
    } catch (_) {}
  }

  Future<void> restore(BillingCheckoutView entry) async {
    setState(() { busy = true; error = null; });
    try {
      final detail = await api.billingQuote(entry.quote.quoteId);
      if (mounted) setState(() => current = detail);
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, 'Could not load bill details.'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void newBill() {
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
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Data bundles'),
        actions: [
          if (current != null)
            IconButton(
              tooltip: 'New data bundle',
              onPressed: busy ? null : newBill,
              icon: const Icon(Icons.add),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
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
                Text('Payment history', style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  tooltip: 'Refresh history',
                  onPressed: busy ? null : reloadHistory,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            if (history.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 28),
                child: Center(child: Text('No payments yet')),
              )
            else
              for (final entry in history)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.receipt_long_outlined),
                    title: Text(entry.quote.itemName),
                    subtitle: Text(
                      entry.quote.customerId + ' · ' + stateLabel(entry.quote.state),
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
        Text('Buy a data bundle', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text('Select your network and bundle. Review the recipient and price before using your wallet.'),
        const SizedBox(height: 18),
        DropdownButtonFormField<BillCategory>(
          value: category,
          decoration: const InputDecoration(labelText: 'Data service'),
          items: categories.map((value) => DropdownMenuItem(
            value: value,
            child: Text(value.name),
          )).toList(growable: false),
          onChanged: busy ? null : selectCategory,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<BillBiller>(
          value: biller,
          decoration: const InputDecoration(labelText: 'Provider'),
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
          decoration: const InputDecoration(labelText: 'Service'),
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
                  : 'Phone number',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amount,
            readOnly: !selectedItem.variableAmount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Amount (NGN)',
              helperText: selectedItem.variableAmount
                  ? 'Enter the provider-supported amount.'
                  : 'Fixed by the provider.',
            ),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: busy ? null : createQuote,
            icon: const Icon(Icons.receipt_long_outlined),
            label: const Text('Review quote'),
          ),
        ],
      ],
    );
  }

  Widget buildTransaction(BillingCheckoutView view) {
    final quote = view.quote;
    final funding = walletAction?.funding;
    final walletPhase = walletAction?.phase;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BillDetails(view: view),
        if (view.phase == 'quoted') ...[
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy ? null : confirmFromWallet,
            icon: const Icon(Icons.account_balance_wallet_outlined),
            label: Text('Confirm ₦' + quote.totalAmount + ' from wallet'),
          ),
        ],
        if (funding != null) ...[
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Add ₦' + funding.amount, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 6),
                  const Text('Transfer the exact amount below. Masanawa will continue this bill automatically after the transfer is verified.'),
                  const SizedBox(height: 12),
                  SelectableText(funding.bankName, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  SelectableText(funding.accountNumber, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 6),
                  Text('Expires: ' + funding.expiresAt),
                ],
              ),
            ),
          ),
        ],
        if (walletPhase == 'fulfilled') ...[
          const SizedBox(height: 12),
          const Card(child: Padding(padding: EdgeInsets.all(14), child: Text('Bill completed successfully.'))),
        ],
        if (view.phase == 'processing' || walletPhase == 'processing' || walletPhase == 'awaiting-funds') ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : refreshCurrent,
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh status'),
          ),
        ],
        if (view.isTerminal || walletPhase == 'fulfilled' || walletPhase == 'failed') ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : newBill,
            icon: const Icon(Icons.add),
            label: const Text('Buy another bundle'),
          ),
        ],
      ],
    );
  }
  String stateLabel(String state) => switch (state) {
        'quoted' => 'Quote ready',
        'checkout-created' => 'Awaiting payment',
        'funded' => 'Payment verified',
        'reserved' => 'Processing',
        'succeeded' => 'Completed',
        'refund-pending' || 'refund-dispatching' || 'refund-submitted' =>
          'Refund processing',
        'refunded' => 'Refunded',
        'expired' => 'Expired',
        _ => state,
      };
}

class BillDetails extends StatelessWidget {
  const BillDetails({super.key, required this.view});
  final BillingCheckoutView view;

  @override
  Widget build(BuildContext context) {
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
            line('Recipient', quote.customerId),
            line('Service', '₦' + quote.serviceAmount),
            line('Fee', '₦' + quote.feeAmount),
            const Divider(),
            line('Total', '₦' + quote.totalAmount, strong: true),
            line('Status', view.phase),
            if (quote.billProviderReference != null)
              line('Provider ref', quote.billProviderReference!),
            if (token != null && token.isNotEmpty) ...[
              const Divider(),
              const Text('Token / code'),
              const SizedBox(height: 6),
              SelectableText(
                token,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
            if (view.phase == 'refunded')
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text('The verified payment was refunded.'),
              ),
          ],
        ),
      ),
    );
  }

  Widget line(String label, String value, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 105, child: Text(label)),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: strong ? const TextStyle(fontWeight: FontWeight.w700) : null,
              ),
            ),
          ],
        ),
      );
}
