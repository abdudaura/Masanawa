import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../agents/masanawa_transport.dart';
import '../core/network/api_client.dart';
import '../core/providers.dart';
import '../core/request_id.dart';
import '../state/session_state.dart';
import 'crypto_state.dart';
import 'internal_crypto_transfer.dart';

class InternalCryptoTransferScreen extends ConsumerWidget {
  const InternalCryptoTransferScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Internal crypto transfer')),
        body: const Center(child: Text('Sign in to view private transfers.')),
      );
    }
    // Destroy text, quote, pending state on account switch, not just on logout.
    return _TransferBody(key: ValueKey(session.user.id), userId: session.user.id);
  }
}

class _TransferBody extends ConsumerStatefulWidget {
  const _TransferBody({super.key, required this.userId});
  final String userId;

  @override
  ConsumerState<_TransferBody> createState() => _TransferBodyState();
}

class _PendingTransfer {
  const _PendingTransfer(this.quoteId, this.requestId);
  final String quoteId;
  final String requestId;
}

class _TransferBodyState extends ConsumerState<_TransferBody> {
  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );
  final _recipient = TextEditingController();
  final _amount = TextEditingController();
  late final InternalCryptoTransferTransport _transport;
  InternalCryptoAvailability? _capabilities;
  List<InternalCryptoReceipt> _history = const [];
  _PendingTransfer? _pending;
  String? _asset;
  String? _error;
  bool _busy = false;
  bool _loading = true;

  String get _journalKey => 'crypto_internal_pending_v1_' + widget.userId;

  @override
  void initState() {
    super.initState();
    _transport = InternalCryptoTransferTransport(
      dio: ref.read(apiClientProvider).dio, baseUrl: kAgentBaseUrl,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _recipient.dispose();
    _amount.dispose();
    super.dispose();
  }

  String _errorMessage(Object error) {
    if (error is ApiException) return error.message;
    if (error is FormatException) return error.message;
    return 'Transfer status could not be checked. No new transfer was started.';
  }

  Future<_PendingTransfer?> _restoreJournal() async {
    final record = await _secure.read(key: _journalKey);
    if (record == null) return null;
    try {
      final json = jsonDecode(record);
      if (json is! Map) throw const FormatException('Invalid pending transfer');
      final quoteId = json['quoteId'];
      final requestId = json['requestId'];
      if (quoteId is! String || quoteId.isEmpty ||
          requestId is! String || requestId.isEmpty) {
        throw const FormatException('Invalid pending transfer');
      }
      return _PendingTransfer(quoteId, requestId);
    } catch (_) {
      // A corrupt encrypted journal must not permit an unreviewed second debit.
      throw const FormatException(
        'Transfer recovery data is unreadable. Contact support before trying again.',
      );
    }
  }

  Future<void> _savePending(_PendingTransfer value) async {
    await _secure.write(key: _journalKey, value: jsonEncode({
      'quoteId': value.quoteId, 'requestId': value.requestId,
    }));
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = null; });
    try {
      // Always load the encrypted journal before allowing a new transfer.
      final pending = await _restoreJournal();
      final capability = await _transport.capabilities();
      final history = await _transport.history();
      if (!mounted) return;
      setState(() {
        _pending = pending;
        _capabilities = capability;
        _history = history;
        _asset = capability.routes.any((r) => r.providerCode == _asset)
            ? _asset : (capability.routes.isEmpty ? null : capability.routes.first.providerCode);
      });
      if (pending != null) await _checkPending();
    } catch (error) {
      if (mounted) setState(() { _error = _errorMessage(error); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _checkPending() async {
    final pending = _pending;
    if (pending == null) return;
    try {
      final receipt = await _transport.byRequest(pending.requestId);
      if (!mounted) return;
      if (receipt == null) {
        setState(() {
          _error = 'No confirmed receipt yet. Check status again before initiating another transfer.';
        });
        return;
      }
      // Readback is authoritative. Clear only after confirmed server receipt.
      await _secure.delete(key: _journalKey);
      if (!mounted) return;
      setState(() {
        _pending = null;
        _error = null;
        if (!_history.any((r) => r.transferId == receipt.transferId)) {
          _history = [receipt, ..._history];
        }
      });
      await ref.read(cryptoWalletProvider.notifier).refresh();
    } catch (error) {
      if (mounted) setState(() { _error = _errorMessage(error); });
    }
  }

  Future<void> _send(InternalCryptoQuote quote) async {
    final request = _PendingTransfer(quote.quoteId, createRequestId());
    try {
      await _savePending(request);
      if (!mounted) return;
      setState(() { _pending = request; });
      await _transport.transfer(requestId: request.requestId, quoteId: request.quoteId);
    } catch (error) {
      if (mounted) setState(() {
        _error = 'Transfer result uncertain: ' + _errorMessage(error);
      });
      // Do not mint another request ID. Read back the same operation.
    } finally {
      await _checkPending();
    }
  }

  Future<void> _quote() async {
    final availability = _capabilities;
    if (_busy || _pending != null || availability?.enabled != true) return;
    final selected = _asset;
    if (selected == null || _recipient.text.trim().isEmpty ||
        _amount.text.trim().isEmpty) {
      setState(() { _error = 'Enter a Masanawa account ID, asset and amount.'; });
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final quote = await _transport.quote(
        quoteRequestId: createRequestId(),
        recipientUserId: _recipient.text.trim(),
        providerCode: selected, amount: _amount.text.trim(),
      );
      if (!mounted) return;
      final accept = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (dialog) => AlertDialog(
          title: const Text('Confirm internal crypto transfer'),
          content: Text(
            'Recipient: ' + quote.recipientUserId +
            '\nYou send: ' + quote.amount + ' ' + quote.asset +
            (quote.network == null ? '' : ' (' + quote.network! + ')') +
            '\nFee: ' + quote.fee +
            '\nExpires: ' + quote.expiresAt.toLocal().toString() +
            '\nThis is an internal custody book transfer, not a blockchain payment.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: const Text('Approve transfer'),
            ),
          ],
        ),
      );
      if (accept != true || !mounted) return;
      if (!DateTime.now().toUtc().isBefore(quote.expiresAt.toUtc())) {
        throw const FormatException('Quote expired. Request a fresh quote.');
      }
      await _send(quote);
    } catch (error) {
      if (mounted) setState(() { _error = _errorMessage(error); });
    } finally {
      if (mounted) setState(() { _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final capability = _capabilities;
    final routes = capability?.routes ?? const <InternalCryptoRoute>[];
    final canSend = !_loading && !_busy && _pending == null &&
        capability?.enabled == true && _asset != null;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Internal crypto transfer'),
        actions: [
          IconButton(
            tooltip: 'Refresh transfer status',
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (capability?.enabled != true)
                  Text(
                    'New transfers unavailable: ' +
                        (capability?.reason ?? 'Gateway verification unavailable'),
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                  )),
                ],
                if (_pending != null) ...[
                  const SizedBox(height: 12),
                  const Text('An earlier approved transfer is unresolved. No second transfer can start.'),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _checkPending,
                    icon: const Icon(Icons.verified_outlined),
                    label: const Text('Check original transfer'),
                  ),
                ],
                const SizedBox(height: 16),
                TextField(
                  controller: _recipient,
                  enabled: canSend,
                  decoration: const InputDecoration(
                    labelText: 'Recipient Masanawa account ID',
                    helperText: 'Verified account ID, not an AI agent or phone number',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: routes.any((r) => r.providerCode == _asset) ? _asset : null,
                  decoration: const InputDecoration(labelText: 'Qualified asset and network'),
                  items: [
                    for (final r in routes)
                      DropdownMenuItem(value: r.providerCode, child: Text(r.label)),
                  ],
                  onChanged: canSend
                      ? (value) => setState(() { _asset = value; })
                      : null,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _amount,
                  enabled: canSend,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Amount in selected crypto asset'),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: canSend ? _quote : null,
                  child: const Text('Review transfer quote'),
                ),
                const SizedBox(height: 24),
                Text('Confirmed internal transfers',
                  style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (_history.isEmpty) const Text('No confirmed internal transfers.'),
                for (final receipt in _history)
                  ListTile(
                    title: Text(receipt.amount + ' ' + receipt.asset +
                        (receipt.network == null ? '' : ' · ' + receipt.network!)),
                    subtitle: Text(
                      (receipt.senderUserId == widget.userId
                          ? 'To ' + receipt.recipientUserId
                          : 'From ' + receipt.senderUserId) +
                      '\n' + receipt.completedAt.toLocal().toString(),
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.check_circle_outline),
                  ),
                const SizedBox(height: 16),
                const Text('Only settled receipts are shown. Check status after an interrupted transfer.'),
              ],
            ),
    );
  }
}
