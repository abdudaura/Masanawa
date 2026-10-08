
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_state.dart';
import 'models.dart';
import 'transport.dart';

/// Nested help screen for Wallet, Chats and private Assistant entry points.
/// The F12 navigation owner mounts this widget; it is NOT a sixth tab.
class CustomerSupportScreen extends ConsumerStatefulWidget {
  const CustomerSupportScreen({
    super.key,
    required this.transport,
    this.operationKind,
    this.operationReference,
  });
  final CustomerSupportTransport transport;
  final SupportOperationKind? operationKind;
  final String? operationReference;

  @override
  ConsumerState<CustomerSupportScreen> createState() => _CustomerSupportScreenState();
}

class _CustomerSupportScreenState extends ConsumerState<CustomerSupportScreen> {
  final _summary = TextEditingController();
  String? _ownerId;
  int _generation = 0;
  bool _loading = false;
  bool _sending = false;
  bool _consent = false;
  String? _error;
  String? _draftKey;
  SupportOperationStatus? _operation;
  List<CustomerSupportTicket> _tickets = const [];

  String? _signedId(SessionState state) =>
      state is SessionSignedIn ? state.user.id : null;

  @override
  void initState() {
    super.initState();
    _ownerId = _signedId(ref.read(sessionProvider));
    if (_ownerId != null) unawaited(_reload());
  }

  @override
  void didUpdateWidget(covariant CustomerSupportScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.transport, widget.transport) ||
        oldWidget.operationReference != widget.operationReference ||
        oldWidget.operationKind != widget.operationKind) {
      _generation++;
      _tickets = const [];
      _operation = null;
      _draftKey = null;
      if (_ownerId != null) unawaited(_reload());
    }
  }

  @override
  void dispose() {
    _generation++;
    _summary.dispose();
    super.dispose();
  }

  bool _current(String? owner, int revision) =>
      mounted && owner != null && owner == _ownerId &&
      _signedId(ref.read(sessionProvider)) == owner &&
      revision == _generation;

  void _changeOwner(String? id) {
    if (_ownerId == id) return;
    _generation++;
    _ownerId = id;
    _summary.clear();
    setState(() {
      _tickets = const [];
      _operation = null;
      _error = null;
      _loading = false;
      _sending = false;
      _consent = false;
      _draftKey = null;
    });
    if (id != null) unawaited(_reload());
  }

  String _safeError(Object error) {
    // Avoid echoing raw provider or network exception bodies/tokens in UI.
    if (error is FormatException) return 'The support response was invalid. Please retry.';
    return 'Support is unavailable. You can retry without repeating a payment.';
  }

  Future<void> _reload() async {
    final owner = _ownerId;
    if (owner == null) return;
    final revision = ++_generation;
    setState(() { _loading = true; _error = null; });
    try {
      final tickets = await widget.transport.tickets();
      SupportOperationStatus? status;
      if (widget.operationKind != null && widget.operationReference != null) {
        // An unavailable or unowned operation must not hide past support tickets.
        // New requests become GENERAL until the financial owner verifies it.
        try {
          status = await widget.transport.operationStatus(
            widget.operationKind!, widget.operationReference!);
        } catch (_) {
          status = null;
        }
      }
      if (!_current(owner, revision)) return;
      setState(() {
        _tickets = tickets;
        _operation = status;
        _loading = false;
      });
    } catch (e) {
      if (!_current(owner, revision)) return;
      setState(() {
        _loading = false;
        _error = _safeError(e);
        // Never display stale operation status after an unsuccessful refresh.
        _operation = null;
        _tickets = const [];
      });
    }
  }

  Future<void> _submit() async {
    if (_sending || _loading || _ownerId == null) return;
    final text = _summary.text.trim();
    if (text.length < 20 || text.length > 1000) {
      setState(() => _error = 'Describe the problem in 20–1000 characters.');
      return;
    }
    if (!_consent) {
      setState(() => _error = 'Review and agree to share this description with support.');
      return;
    }
    final owner = _ownerId;
    final revision = _generation;
    final requestKey = _draftKey ??= newSupportRequestKey();
    setState(() { _sending = true; _error = null; });
    try {
      // This is the ONLY write. No transaction is retried, refunded or dispatched.
      final ticket = await widget.transport.submit(
        requestKey: requestKey,
        kind: _operation == null ? 'general' : widget.operationKind!.code,
        reference: _operation == null ? null : widget.operationReference,
        summary: text,
        shareWithSupport: true,
      );
      if (!_current(owner, revision)) return;
      setState(() {
        _tickets = [ticket, ..._tickets.where((old) => old.id != ticket.id)];
        _summary.clear();
        _consent = false;
        _draftKey = null;
        _sending = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request saved. Check its status here.')),
        );
      }
    } catch (e) {
      if (!_current(owner, revision)) return;
      setState(() { _sending = false; _error = _safeError(e); });
      // _draftKey intentionally retained for safe retry after ambiguous timeout.
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(sessionProvider);
    ref.listen<SessionState>(sessionProvider, (previous, next) {
      final id = _signedId(next);
      if (id != _ownerId) _changeOwner(id);
    });
    final id = _signedId(state);
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      body: id == null || id != _ownerId
          ? const Center(child: Text('Sign in to view your support requests.'))
          : RefreshIndicator(
              onRefresh: _reload,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Need help?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  const Text('Check a verified payment status before trying again. We cannot promise a refund or instant human reply.'),
                  const SizedBox(height: 14),
                  if (_loading) const LinearProgressIndicator(),
                  if (_error != null) ...[
                    Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    TextButton(onPressed: _loading ? null : _reload, child: const Text('Retry status')),
                  ],
                  if (widget.operationKind != null) ...[
                    Text(widget.operationKind!.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (_operation == null)
                      const Text('Payment status cannot be verified here. You may send a general support request without linking an unverified reference; do not repeat the payment.')
                    else ...[
                      Text('Reference: ${_operation!.referenceMask}'),
                      Text('Verified record: ${_operation!.phase}'),
                      Text(_operation!.message),
                    ],
                    const SizedBox(height: 18),
                  ],
                  const Text('Describe your issue', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('support-summary'),
                    controller: _summary,
                    minLines: 3,
                    maxLines: 7,
                    maxLength: 1000,
                    enabled: !_sending && !_loading,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: 'Explain what happened, without sharing passwords, OTP codes or private chats.',
                    ),
                    onChanged: (_) => _draftKey = null,
                  ),
                  CheckboxListTile(
                    key: const Key('support-consent'),
                    contentPadding: EdgeInsets.zero,
                    value: _consent,
                    onChanged: _sending || _loading ? null : (value) {
                      setState(() => _consent = value ?? false);
                    },
                    title: const Text('I agree to share this description and the selected verified transaction reference with support.'),
                    subtitle: const Text('Private messages and attachments are not shared.'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  FilledButton(
                    key: const Key('support-submit'),
                    onPressed: _sending || _loading ? null : _submit,
                    child: Text(_sending ? 'Saving…' : 'Submit support request'),
                  ),
                  const SizedBox(height: 26),
                  const Text('My support requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  if (!_loading && _tickets.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 18),
                      child: Text('No support requests yet.'),
                    ),
                  for (final ticket in _tickets)
                    Card(
                      key: Key('support-ticket-${ticket.id}'),
                      child: ListTile(
                        title: Text(ticket.kind == 'general'
                          ? 'General support'
                          : ticket.kind == 'billing_quote' ? 'Bill payment' : 'Crypto transaction'),
                        subtitle: Text(
                          '${ticket.status == 'queued' ? 'Queued for review' : ticket.status}'
                          '${ticket.referenceMask == null ? '' : ' • ${ticket.referenceMask}'}'
                          '\n${ticket.resolution ?? ticket.summary}',
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
