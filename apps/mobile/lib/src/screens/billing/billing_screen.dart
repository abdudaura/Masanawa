import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/billing_models.dart';
import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../state/session_state.dart';

class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key});

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> {
  final customer = TextEditingController();
  final amount = TextEditingController();
  final checkoutEmail = TextEditingController();

  List<BillCategory> categories = const [];
  List<BillBiller> billers = const [];
  List<BillItem> items = const [];
  List<BillingCheckoutView> history = const [];
  BillCategory? category;
  BillBiller? biller;
  BillItem? item;
  BillingCheckoutView? current;
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
    checkoutEmail.dispose();
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
        categories = nextCategories;
        history = nextHistory;
        loading = false;
      });
    } catch (value) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = safeError(value, 'Billing is unavailable right now.');
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
    if (selectedCategory == null || selectedBiller == null || selectedItem == null) {
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

  String? paymentEmail() {
    final session = ref.read(sessionProvider);
    if (session is SessionSignedIn) {
      final known = session.user.email?.trim();
      if (known != null && known.isNotEmpty) return known;
    }
    final typed = checkoutEmail.text.trim();
    return typed.isEmpty ? null : typed;
  }

  Future<void> startCheckout() async {
    final view = current;
    if (view == null) return;
    final email = paymentEmail();
    if (email == null || !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() => error = 'Enter a valid email for secure checkout.');
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      final next = await api.startBillingCheckout(
        quoteId: view.quote.quoteId,
        quoteRevision: view.quote.revision,
        checkoutEmail: email,
      );
      if (!mounted) return;
      setState(() => current = next);
      await openCheckout(next.checkoutUrl);
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, 'Could not start checkout.'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> openCheckout(String? value) async {
    final uri = value == null ? null : Uri.tryParse(value);
    if (uri == null ||
        uri.scheme != 'https' ||
        !(uri.host == 'flutterwave.com' || uri.host.endsWith('.flutterwave.com'))) {
      if (mounted) setState(() => error = 'The payment link could not be trusted.');
      return;
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      setState(() => error = 'Could not open Flutterwave checkout.');
    }
  }

  Future<void> verify() async {
    final view = current;
    if (view == null) return;
    setState(() { busy = true; error = null; });
    try {
      final next = await api.verifyBillingPayment(
        quoteId: view.quote.quoteId,
        quoteRevision: view.quote.revision,
      );
      if (!mounted) return;
      setState(() => current = next);
      await reloadHistory();
    } catch (value) {
      if (mounted) {
        setState(() => error = safeError(
          value,
          'Payment is not verified yet. Try again after checkout.',
        ));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> refreshCurrent() async {
    final view = current;
    if (view == null) return;
    setState(() { busy = true; error = null; });
    try {
      final next = await api.billingQuote(view.quote.quoteId);
      if (mounted) setState(() => current = next);
      await reloadHistory();
    } catch (value) {
      if (mounted) setState(() => error = safeError(value, 'Could not refresh status.'));
    } finally {
      if (mounted) setState(() => busy = false);
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
      checkoutEmail.clear();
      error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final needsEmail =
        session is SessionSignedIn && (session.user.email?.trim().isEmpty ?? true);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bills & payments'),
        actions: [
          if (current != null)
            IconButton(
              tooltip: 'New bill',
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
              buildForm(needsEmail)
            else
              buildTransaction(current!, needsEmail),
            const SizedBox(height: 28),
            Row(
              children: [
                Text('Recent bills', style: Theme.of(context).textTheme.titleMedium),
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
                child: Center(child: Text('No bill payments yet')),
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

  Widget buildForm(bool needsEmail) {
    final selectedItem = item;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Pay a bill', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text('Choose a live provider service. A quote is created before payment.'),
        const SizedBox(height: 18),
        DropdownButtonFormField<BillCategory>(
          value: category,
          decoration: const InputDecoration(labelText: 'Category'),
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
                  : (category?.code == 'AIRTIME' || category?.code == 'MOBILEDATA')
                      ? 'Phone number'
                      : 'Customer / meter / smartcard number',
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
          if (needsEmail) ...[
            const SizedBox(height: 12),
            TextField(
              controller: checkoutEmail,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Email for secure checkout'),
            ),
          ],
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

  Widget buildTransaction(BillingCheckoutView view, bool needsEmail) {
    final quote = view.quote;
    final canVerify =
        view.phase == 'checkout' || view.phase == 'paid' || view.phase == 'processing';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BillDetails(view: view),
        if (view.phase == 'quoted') ...[
          if (needsEmail) ...[
            const SizedBox(height: 12),
            TextField(
              controller: checkoutEmail,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email for secure checkout'),
            ),
          ],
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy ? null : startCheckout,
            icon: const Icon(Icons.open_in_new),
            label: Text('Pay ₦' + quote.totalAmount + ' securely'),
          ),
        ],
        if (view.phase == 'checkout' && view.checkoutUrl != null) ...[
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: busy ? null : () => openCheckout(view.checkoutUrl),
            icon: const Icon(Icons.open_in_new),
            label: const Text('Open Flutterwave checkout'),
          ),
        ],
        if (canVerify) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : verify,
            icon: const Icon(Icons.verified_outlined),
            label: const Text('Verify payment'),
          ),
          TextButton.icon(
            onPressed: busy ? null : refreshCurrent,
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh status'),
          ),
        ],
        if (view.isTerminal) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : newBill,
            icon: const Icon(Icons.add),
            label: const Text('Pay another bill'),
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
