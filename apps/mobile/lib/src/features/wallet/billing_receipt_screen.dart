import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'billing_receipt.dart';

/// C54: independent Bills receipt detail, not a Chats redirect. A parent
/// supplies app-owned auth/session, feature eligibility and Gwani handoff.
class BillReceiptScreen extends StatefulWidget {
  const BillReceiptScreen({
    super.key,
    required this.reference,
    required this.accountKey,
    required this.reader,
    this.enabled = false,
    this.onAskGwani,
  });

  final String reference;
  final String accountKey;
  final BillReceiptReader reader;
  final bool enabled;
  final ValueChanged<String>? onAskGwani;

  @override
  State<BillReceiptScreen> createState() => _BillReceiptScreenState();
}

class _BillReceiptScreenState extends State<BillReceiptScreen> {
  int _generation = 0;
  BillReceipt? _data;
  bool _busy = false;
  String? _problem;

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(() {
      if (mounted && widget.enabled) _load();
    });
  }

  @override
  void didUpdateWidget(covariant BillReceiptScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountKey != widget.accountKey ||
        oldWidget.reference != widget.reference ||
        oldWidget.reader != widget.reader ||
        oldWidget.enabled != widget.enabled) {
      _generation++;
      _data = null;
      _problem = null;
      _busy = false;
      scheduleMicrotask(() {
        if (mounted && widget.enabled) _load();
      });
    }
  }

  @override
  void dispose() {
    _generation++;
    super.dispose();
  }

  Future<void> _load({bool refresh = false}) async {
    final sequence = ++_generation;
    setState(() { _busy = true; _problem = null; });
    try {
      final receipt = await widget.reader.read(widget.reference, refresh: refresh);
      if (!mounted || sequence != _generation) return;
      setState(() { _busy = false; _data = receipt; });
    } catch (error) {
      if (!mounted || sequence != _generation) return;
      String problem = 'unavailable';
      if (error is FormatException) problem = 'invalid';
      if (error is DioException) {
        problem = switch (error.response?.statusCode) {
          401 || 403 => 'denied',
          404 => 'missing',
          410 => 'disabled',
          _ => error.type == DioExceptionType.connectionError ||
                   error.type == DioExceptionType.connectionTimeout ||
                   error.type == DioExceptionType.receiveTimeout
              ? 'offline' : 'unavailable',
        };
      }
      setState(() { _busy = false; _problem = problem; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ha = Localizations.localeOf(context).languageCode == 'ha';
    String tr(String en, String haText) => ha ? haText : en;
    final receipt = _data;
    final issue = widget.enabled ? _problem : 'disabled';
    final messages = <String, String>{
      'denied': tr('Sign in to the purchasing account.', 'Shiga asusun da ya yi sayan.'),
      'missing': tr('Receipt not found in this account.', 'Ba a sami rasidi a asusun nan ba.'),
      'disabled': tr('Receipt viewing is unavailable.', 'Ba a iya kallon rasidi yanzu.'),
      'invalid': tr('Invalid receipt reference.', 'Lambar rasidin ba ta dace ba.'),
      'offline': tr('Offline. Showing the previous result, if available.', 'Babu intanet. Ana nuna tsohon sakamako idan yana nan.'),
      'unavailable': tr('Unable to check receipt. Try again.', 'Ba a iya duba rasidi ba. Ka sake gwadawa.'),
    };
    return Scaffold(
      appBar: AppBar(title: Text(tr('Bill receipt', 'Rasidin biyan kuɗi'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_busy && receipt == null)
            const Center(child: CircularProgressIndicator()),
          if (issue != null) ...[
            Text(messages[issue] ?? messages['unavailable']!),
            if (issue != 'disabled' && issue != 'denied' && issue != 'invalid')
              OutlinedButton(
                onPressed: _busy ? null : () => _load(),
                child: Text(tr('Retry', 'Sake gwadawa')),
              ),
          ],
          if (receipt != null) ...[
            Text(receipt.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Semantics(liveRegion: true, child: Text(switch (receipt.status) {
              BillReceiptStatus.ready => tr('Ready', 'A shirye'),
              BillReceiptStatus.processing => tr('Processing', 'Ana sarrafawa'),
              BillReceiptStatus.checking => tr('Checking', 'Ana dubawa'),
              BillReceiptStatus.successful => tr('Confirmed', 'An tabbatar'),
              BillReceiptStatus.failed => tr('Failed', 'Bai yi nasara ba'),
              BillReceiptStatus.reversed => tr('Reversed', 'An mayar da kuɗi'),
              BillReceiptStatus.needsReview => tr('Needs review', 'Sai an duba'),
            })),
            Text(receipt.summary),
            for (final row in receipt.rows)
              ListTile(title: Text(row.label), subtitle: SelectableText(row.value)),
            if (!receipt.finalStatus)
              Text(tr(
                'Pending is not settled. Check before making another payment.',
                'Jiran tabbaci ba biyan da ya kammala ba. A bincika kafin sake biya.',
              )),
            if (receipt.canRefresh)
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _load(refresh: true),
                icon: const Icon(Icons.refresh),
                label: Text(tr('Check provider status', 'Duba matsayin mai bayarwa')),
              ),
            if (widget.onAskGwani != null)
              TextButton.icon(
                onPressed: () => widget.onAskGwani!(receipt.reference),
                icon: const Icon(Icons.support_agent),
                label: Text(tr('Ask Gwani', 'Tambayi Gwani')),
              ),
            if (_busy) const LinearProgressIndicator(),
          ],
        ],
      ),
    );
  }
}
