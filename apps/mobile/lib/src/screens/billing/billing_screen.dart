import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
  if (service?.trim().toLowerCase() != 'data') return null;
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
  String period = 'All';
  bool userSelectedNetwork = false;

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
      // History failure must not block purchasing available data bundles.
      List<BillingCheckoutView> nextHistory = const [];
      try { nextHistory = await api.billingHistory(limit: 30); } catch (_) {}
      if (!mounted) return;
      setState(() {
        categories = nextCategories.where(isDataBundleBillCategory).toList(growable: false);
        history = nextHistory;
        loading = false;
      });
      if (category == null) {
        final matched =
            billingCategoryForHomeService(nextCategories, 'data');
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
      setState(() => error = 'Select a network and a data bundle.');
      return;
    }
    if (recipient.isEmpty || (num.tryParse(rawAmount) ?? 0) <= 0) {
      setState(() => error = 'Enter a valid phone number to buy this bundle.');
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
      userSelectedNetwork = false;
      period = 'All';
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
              ListTile(
                dense: true,
                leading: const Icon(Icons.info_outline),
                title: Text(error!),
                trailing: TextButton(onPressed: busy ? null : load,
                  child: const Text('Retry')),
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


  // Phone number portability means prefixes suggest rather than prove operator.
  String? suggestedNetwork(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final local = digits.startsWith('234') && digits.length >= 6
        ? '0' + digits.substring(3) : digits;
    if (local.length < 4) return null;
    final prefix = local.substring(0, 4);
    if (const {'0803','0806','0703','0706','0810','0813','0814','0816','0903','0906','0913','0916'}.contains(prefix)) return 'mtn';
    if (const {'0802','0808','0701','0708','0812','0901','0902','0904','0907','0912'}.contains(prefix)) return 'airtel';
    if (const {'0805','0807','0811','0815','0905','0915'}.contains(prefix)) return 'glo';
    if (const {'0809','0817','0818','0908','0909'}.contains(prefix)) return '9mobile';
    return null;
  }

  String networkName(BillBiller value) {
    final name = value.name.toLowerCase();
    if (name.contains('mtn')) return 'mtn';
    if (name.contains('airtel')) return 'airtel';
    if (name.contains('glo')) return 'glo';
    if (name.contains('9mobile') || name.contains('etisalat')) return '9mobile';
    return '';
  }

  // Infer only stated durations; never invent validity for missing metadata.
  String planPeriod(BillItem plan) {
    final text = plan.name.toLowerCase();
    if (RegExp(r'\b(daily|1\s*day|24\s*hours?)\b').hasMatch(text)) return 'Daily';
    if (RegExp(r'\b(weekly|7\s*days?)\b').hasMatch(text)) return 'Weekly';
    if (RegExp(r'\b(monthly|30\s*days?|31\s*days?)\b').hasMatch(text)) return 'Monthly';
    return 'Other';
  }

  void phoneChanged(String value) {
    if (userSelectedNetwork || busy || category == null) return;
    final suggested = suggestedNetwork(value);
    if (suggested == null) return;
    for (final provider in billers) {
      if (networkName(provider) == suggested &&
          biller?.billerCode != provider.billerCode) {
        selectBiller(provider);
        break;
      }
    }
  }

  Widget buildForm() {
    final wallet = ref.watch(walletProvider);
    final balance = wallet.when(
      data: (value) => value,
      loading: () => null,
      error: (_, _) => null,
    );
    final available = items.where((value) =>
      !value.variableAmount && (num.tryParse(value.amount) ?? 0) > 0 &&
      (period == 'All' || planPeriod(value) == period)).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('Data Bundles', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 6),
      const Text('Choose your network, enter a number and pick a bundle.'),
      const SizedBox(height: 14),
      Card(child: Padding(padding: const EdgeInsets.all(14),
        child: Row(children: [
          const Icon(Icons.account_balance_wallet_outlined),
          const SizedBox(width: 12),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Wallet balance'),
            Text(balance?.ngnBalanceLabel ?? 'Balance unavailable',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          ])),
          TextButton(onPressed: () => context.go('/home?tab=wallet'),
            child: const Text('Fund')),
        ]))),
      const SizedBox(height: 16),
      TextField(controller: customer,
        keyboardType: TextInputType.phone,
        autofillHints: const [AutofillHints.telephoneNumber],
        decoration: const InputDecoration(
          labelText: 'Phone number',
          hintText: '0803 123 4567',
          prefixIcon: Icon(Icons.phone_android_outlined)),
        onChanged: phoneChanged),
      const SizedBox(height: 16),
      Text('Network', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 4),
      const Text('Prefixes are suggestions only. Confirm the network if this number was ported.',
        style: TextStyle(fontSize: 12)),
      const SizedBox(height: 10),
      if (busy && billers.isEmpty)
        const LinearProgressIndicator(minHeight: 2),
      Wrap(spacing: 8,runSpacing: 8, children: [
        for (final provider in billers)
          ChoiceChip(
            selected: biller?.billerCode == provider.billerCode,
            avatar: CircleAvatar(radius: 12,child: Text(
              provider.name.isEmpty ? '?' : provider.name[0].toUpperCase(),
              style: const TextStyle(fontSize: 11))),
            label: Text(provider.name),
            onSelected: busy ? null : (_) {
              userSelectedNetwork = true;
              selectBiller(provider);
            }),
      ]),
      if (billers.isEmpty && !busy)
        const Padding(padding: EdgeInsets.symmetric(vertical: 12),
          child: Text('No networks returned by the provider. Refresh to retry.')),
      if (biller != null) ...[
        const SizedBox(height: 18),
        Text('Available bundles',style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        SingleChildScrollView(scrollDirection: Axis.horizontal,
          child: Row(children: [
          for (final option in const ['All','Daily','Weekly','Monthly'])
            Padding(padding: const EdgeInsets.only(right: 7),
              child: ChoiceChip(label: Text(option),selected: period == option,
                onSelected: (_) => setState(() => period = option))),
        ])),
        const SizedBox(height: 8),
        if (busy && items.isEmpty)
          const LinearProgressIndicator(minHeight: 2),
        if (!busy && available.isEmpty)
          const Padding(padding: EdgeInsets.all(16),
            child: Text('No priced bundles in this category from the provider. Try All or another network.')),
        for (final plan in available)
          Card(child: ListTile(
            title: Text(plan.name, maxLines: 2,overflow: TextOverflow.ellipsis),
            subtitle: Text(planPeriod(plan) == 'Other'
                ? 'Provider plan' : planPeriod(plan)),
            trailing: Text('₦' + plan.amount,
              style: const TextStyle(fontWeight: FontWeight.w700)),
            onTap: busy ? null : () async {
              final phone = customer.text.trim();
              if (!RegExp(r'^(?:0[789]\d{9}|\+?234[789]\d{9})$').hasMatch(phone)) {
                setState(() => error = 'Enter a valid Nigerian phone number first.');
                return;
              }
              selectItem(plan);
              await createQuote();
            })),
      ],
    ]);
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
