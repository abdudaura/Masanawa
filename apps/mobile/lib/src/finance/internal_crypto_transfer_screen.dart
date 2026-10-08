import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/masanawa_transport.dart';
import '../core/providers.dart';
import '../state/session_state.dart';
import 'internal_crypto_transfer.dart';

final internalCryptoTransferTransportProvider = Provider<InternalCryptoTransferTransport>((ref) {
  final api = ref.watch(apiClientProvider);
  // Uses the shared Dio auth/401-refresh interceptor, never a client API key.
  return GatewayInternalCryptoTransferTransport(dio: api.dio, baseUrl: kAgentBaseUrl);
});
final internalCryptoTransferJournalProvider = Provider<InternalCryptoTransferJournal>((ref) {
  return InternalCryptoTransferJournal();
});

/// Deliberate, private transfer entry point. Does not auto-submit a quote,
/// microphone, payment or transfer merely when the screen is opened.
class InternalCryptoTransferScreen extends ConsumerStatefulWidget {
  const InternalCryptoTransferScreen({
    required this.ownerId, required this.providerCode, super.key,
  });
  final String ownerId;
  final String providerCode;
  @override
  ConsumerState<InternalCryptoTransferScreen> createState() => _InternalCryptoTransferScreenState();
}

class _InternalCryptoTransferScreenState extends ConsumerState<InternalCryptoTransferScreen> {
  final _recipient = TextEditingController();
  final _amount = TextEditingController();
  InternalCryptoTransferQuote? _quote;
  bool _busy=false;
  String? _message;
  String? _pendingId;
  bool _recovering=true;

  bool get _ownerMatches {
    final session=ref.read(sessionProvider);
    return session is SessionSignedIn && session.user.id == widget.ownerId;
  }
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _restore());
  }
  @override
  void dispose() {
    _recipient.dispose();
    _amount.dispose();
    super.dispose();
  }
  void _report(Object error) {
    if(!mounted) return;
    setState(() { _message = error is DioException
      ? (error.response?.statusCode == 401
        ? 'Session expired. Sign in again.'
        : error.response?.statusCode == 503
          ? 'This route or market is not currently enabled for internal transfers.'
          : 'Transfer could not be verified. Check status before trying again.')
      : error is FormatException
        ? 'Check the amount and recipient details.'
        : 'Transfer is not available. Check status or retry when connected.'; });
  }
  Future<void> _restore() async {
    if(!_ownerMatches){if(mounted)setState(() => _recovering=false);return;}
    try {
      final journal=ref.read(internalCryptoTransferJournalProvider);
      final id=await journal.pendingRequest(widget.ownerId);
      if(!mounted || !_ownerMatches)return;
      if(id!=null){
        _pendingId=id;
        await _readStatus(id);
      }
    }catch(e){_report(e);}
    finally {if(mounted)setState(() => _recovering=false);}
  }
  Future<void> _readStatus(String id) async {
    if(!_ownerMatches)return;
    final status=await ref.read(internalCryptoTransferTransportProvider).read(id);
    if(!mounted || !_ownerMatches)return;
    setState(() {
      _quote=status;
      _message=status==null
        ? 'No saved quote reached the server. You can clear it and start again.'
        : status.completed ? 'Transfer completed. Receipt is authoritative.'
        : status.expired ? 'Quote expired. Clear it to create a new one.'
        : 'Quote is pending. After restart, confirmation is unavailable; an unapproved quote cannot move funds.';
    });
    if(status?.completed==true) await ref.read(internalCryptoTransferJournalProvider).clear(widget.ownerId);
  }
  Future<void> _quoteTransfer() async {
    if(!_ownerMatches || _busy || _pendingId!=null)return;
    if(_recipient.text.trim().length<3 ||
       !RegExp(r'^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$').hasMatch(_amount.text.trim()) ||
       _amount.text.trim()=='0') {
      setState(() => _message='Enter a Masanawa account email/phone and positive exact amount.');
      return;
    }
    setState(() { _busy=true; _message=null; });
    try {
      final id=await ref.read(internalCryptoTransferJournalProvider).begin(widget.ownerId);
      if(!mounted || !_ownerMatches)return;
      setState(() => _pendingId=id);
      final quote=await ref.read(internalCryptoTransferTransportProvider).quote(
        requestId:id, recipient:_recipient.text.trim(),
        providerCode:widget.providerCode, amount:_amount.text.trim());
      if(!mounted || !_ownerMatches)return;
      setState(() { _quote=quote; _message=null; });
    } catch(e) { _report(e); }
    finally { if(mounted) setState(() => _busy=false); }
  }
  Future<void> _confirm() async {
    final quote=_quote;
    if(!_ownerMatches || _busy || quote?.confirmationToken == null ||
       quote!.expired || quote.status!='quoted')return;
    setState(() { _busy=true; _message=null; });
    try {
      final confirmed=await ref.read(internalCryptoTransferTransportProvider)
        .confirm(quote.requestId,quote.confirmationToken!);
      if(!mounted || !_ownerMatches)return;
      setState(() => _quote=confirmed);
      if(confirmed.completed) {
        await ref.read(internalCryptoTransferJournalProvider).clear(widget.ownerId);
        if(mounted) setState(() => _message='Transfer completed and recorded on both accounts.');
      } else {
        if(mounted)setState(() => _message='Confirmation not accepted; no transfer was posted.');
      }
    } catch(e) {
      // Network loss after commit is an unknown outcome. Only GET with the same
      // request ID may establish the final status; never post a fresh debit.
      try { await _readStatus(quote.requestId); } catch (_) { _report(e); }
    } finally { if(mounted)setState(() => _busy=false); }
  }
  Future<void> _clear() async {
    if(!_ownerMatches || _busy)return;
    final quote=_quote;
    if(quote!=null && quote.status=='quoted' && !quote.expired) {
      setState(() => _message='This quote is still active. Wait for expiry or recover it before starting a new quote.');
      return;
    }
    await ref.read(internalCryptoTransferJournalProvider).clear(widget.ownerId);
    if(mounted && _ownerMatches) setState(() {
      _pendingId=null; _quote=null; _message=null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final active=ref.watch(sessionProvider);
    final signedIn=active is SessionSignedIn && active.user.id==widget.ownerId;
    return Scaffold(
      appBar: AppBar(title: const Text('Send crypto to Masanawa user')),
      body: !signedIn
        ? const Center(child: Text('Sign in with the same account to view this private transfer.'))
        : _recovering
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding:const EdgeInsets.all(20),children:[
              Text('Asset route: ${widget.providerCode}',style:Theme.of(context).textTheme.titleMedium),
              const SizedBox(height:8),
              const Text('Internal custody book transfer only. No blockchain send. No Credits or fiat transfer.'),
              const SizedBox(height:20),
              if(_pendingId==null)...[
                TextField(controller:_recipient,enabled:!_busy,
                  decoration:const InputDecoration(labelText:'Recipient email or phone',
                    helperText:'Recipient must have an active Masanawa account')),
                const SizedBox(height:12),
                TextField(controller:_amount,enabled:!_busy,
                  keyboardType:const TextInputType.numberWithOptions(decimal:true),
                  decoration:const InputDecoration(labelText:'Amount',
                    helperText:'Enter an exact amount in the selected asset/network')),
                const SizedBox(height:12),
                FilledButton(onPressed:_busy?null:_quoteTransfer,child:const Text('Get secure transfer quote')),
              ],
              if(_pendingId!=null)...[
                Text('Request ID: $_pendingId',maxLines:2),
                const SizedBox(height:12),
                if(_quote!=null)...[
                  Text('Recipient: ${_quote!.recipientLabel}'),
                  Text('Send: ${_quote!.amount} ${_quote!.asset}'),
                  Text('Network: ${_quote!.network ?? "provider-default"}'),
                  Text('Fee: ${_quote!.fee}'),
                  Text('State: ${_quote!.status}'),
                  Text('Expires: ${_quote!.expiresAt.toLocal()}'),
                  if(_quote!.completedAt!=null)Text('Completed: ${_quote!.completedAt!.toLocal()}'),
                  const SizedBox(height:16),
                  if(_quote!.status=='quoted' && !_quote!.expired &&
                     _quote!.confirmationToken!=null)
                    FilledButton(onPressed:_busy?null:_confirm,
                      child:const Text('Confirm this exact crypto transfer')),
                ],
                OutlinedButton(onPressed:_busy?null:() async {
                  try { await _readStatus(_pendingId!); }catch(e){_report(e);}
                },child:const Text('Check server status')),
                TextButton(onPressed:_busy?null:_clear,child:const Text('Start a different quote')),
              ],
              if(_busy)const Center(child:CircularProgressIndicator()),
              if(_message!=null)Padding(padding:const EdgeInsets.only(top:12),
                child:Text(_message!,semanticsLabel:_message)),
            ]),
    );
  }
}
