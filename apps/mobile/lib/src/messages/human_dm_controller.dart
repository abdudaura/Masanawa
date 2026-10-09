import 'dart:async';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import 'human_dm_outbox.dart';
import 'human_dm_transport.dart';

/// One idempotency ID per intent; never generate a fresh ID on network retry.
String createHumanDmRequestId() {
  final random=Random.secure();
  final bytes=List<int>.generate(16,(_)=>random.nextInt(256));
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  String hex(int n)=>n.toRadixString(16).padLeft(2,'0');
  final value=bytes.map(hex).join();
  return '${value.substring(0,8)}-${value.substring(8,12)}-${value.substring(12,16)}-${value.substring(16,20)}-${value.substring(20)}';
}
class HumanDmState {
  const HumanDmState({this.messages=const [],this.pending=const [],
    this.loading=true,this.loadingOlder=false,this.nextBeforeSequence,
    this.error});
  final List<HumanDmMessage> messages;
  final List<HumanDmPending> pending;
  final bool loading,loadingOlder;
  final int? nextBeforeSequence;
  final String? error;
  HumanDmState copyWith({List<HumanDmMessage>? messages,List<HumanDmPending>? pending,
    bool? loading,bool? loadingOlder,int? nextBeforeSequence,bool clearCursor=false,
    String? error,bool clearError=false}) =>
      HumanDmState(messages:messages??this.messages,pending:pending??this.pending,
        loading:loading??this.loading,loadingOlder:loadingOlder??this.loadingOlder,
        nextBeforeSequence:clearCursor?null:nextBeforeSequence??this.nextBeforeSequence,
        error:clearError?null:error??this.error);
}
class HumanDmController extends StateNotifier<HumanDmState> {
  HumanDmController(this.userId,this.conversationId,this.transport,this.outbox,
      {required this.isAccountCurrent})
      :super(const HumanDmState()) {
    Future<void>.microtask(load);
  }
  final String userId,conversationId;
  final HumanDmTransport transport;
  final HumanDmOutbox outbox;
  final bool Function() isAccountCurrent;
  bool _closed=false;
  bool _refreshing=false;
  final Set<String> _inFlight={};
  Future<void> _storageChain=Future<void>.value();
  Future<T> _withStorageLock<T>(Future<T> Function() operation) async {
    final preceding=_storageChain;
    final released=Completer<void>();
    _storageChain=released.future;
    await preceding;
    try { return await operation(); } finally { released.complete(); }
  }
  String _error(Object e) => e.toString().replaceFirst(RegExp(r'^ApiException:\s*'),'');
  Future<void> load() async {
    if(_refreshing||_closed||!isAccountCurrent())return;
    _refreshing=true;
    try {
      final pending=await _withStorageLock(() => outbox.load(userId,conversationId));
      if(_closed||!isAccountCurrent())return;
      state=state.copyWith(pending:pending,loading:true,clearError:true);
      final page=await transport.history(conversationId);
      if(_closed||!isAccountCurrent())return;
      final acknowledged={for(final m in page.messages) m.clientMessageId};
      final remaining=await _withStorageLock(() async {
        final latest=await outbox.load(userId,conversationId);
        final remaining=latest.where((p)=>!acknowledged.contains(p.id)).toList();
        if(remaining.length!=latest.length) await outbox.save(userId,conversationId,remaining);
        return remaining;
      });
      if(_closed||!isAccountCurrent())return;
      final merged={for(final m in state.messages)m.messageId:m};
      for(final m in page.messages){merged[m.messageId]=m;}
      state=state.copyWith(messages:merged.values.toList()..sort((a,b)=>b.sequence.compareTo(a.sequence)),pending:remaining,
        loading:false,nextBeforeSequence:page.nextBeforeSequence,
        clearCursor:page.nextBeforeSequence==null,clearError:true);
      await _acknowledge(page.messages);
    } catch(e) {
      if(!_closed)state=state.copyWith(loading:false,error:_error(e));
    } finally { _refreshing=false; }
  }
  Future<void> _acknowledge(List<HumanDmMessage> page) async {
    final fromOthers=page.where((m)=>m.senderUserId!=userId);
    if(fromOthers.isEmpty||!isAccountCurrent())return;
    final latest=fromOthers.map((m)=>m.sequence).reduce(max);
    try { await transport.read(conversationId,latest); } catch (_) {
      // Read receipts are retried on next refresh; a failure never loses texts.
    }
  }
  Future<void> older() async {
    if(_closed||!isAccountCurrent()||state.loading||state.loadingOlder||state.nextBeforeSequence==null)return;
    final cursor=state.nextBeforeSequence!;
    state=state.copyWith(loadingOlder:true,clearError:true);
    try{
      final page=await transport.history(conversationId,beforeSequence:cursor);
      if(_closed||!isAccountCurrent())return;
      final byId={for(final m in state.messages)m.messageId:m};
      for(final m in page.messages) {byId[m.messageId]=m;}
      final merged=byId.values.toList()..sort((a,b)=>b.sequence.compareTo(a.sequence));
      state=state.copyWith(messages:merged,loadingOlder:false,
        nextBeforeSequence:page.nextBeforeSequence,
        clearCursor:page.nextBeforeSequence==null);
    }catch(e) { if(!_closed)state=state.copyWith(loadingOlder:false,error:_error(e)); }
  }
  Future<void> send(String raw) async {
    final text=raw.trim();
    if(text.isEmpty||text.length>4096||_closed||!isAccountCurrent())return;
    final pending=HumanDmPending(createHumanDmRequestId(),text,DateTime.now().toUtc());
    try {
      final next=await _withStorageLock(() async {
        final latest=await outbox.load(userId,conversationId);
        if(latest.length>=50)throw StateError('Outbox is full');
        final rows=[...latest,pending];
        // Commit encrypted pending intent BEFORE any network action.
        await outbox.save(userId,conversationId,rows);
        if(!_closed&&isAccountCurrent())state=state.copyWith(pending:rows,clearError:true);
        return rows;
      });
      if(_closed||!isAccountCurrent()||!next.any((row)=>row.id==pending.id))return;
      await retry(pending.id);
    } catch(_) {
      if(!_closed)state=state.copyWith(error:'Cannot securely queue your message. Nothing new was sent.');
    }
  }
  Future<void> retry(String clientMessageId) async {
    if(_closed||!isAccountCurrent()||!_inFlight.add(clientMessageId))return;
    try {
      final matches=state.pending.where((p)=>p.id==clientMessageId);
      if(matches.isEmpty)return;
      final pending=matches.first;
      if(!isAccountCurrent())return;
      final acknowledged=await transport.send(conversationId,
        clientMessageId:pending.id,text:pending.text);
      if(_closed||!isAccountCurrent())return;
      final next=await _withStorageLock(() async {
        final latest=await outbox.load(userId,conversationId);
        final rows=latest.where((p)=>p.id!=clientMessageId).toList();
        await outbox.save(userId,conversationId,rows);
        return rows;
      });
      if(_closed||!isAccountCurrent())return;
      final messages={for(final m in state.messages)m.messageId:m};
      messages[acknowledged.messageId]=acknowledged;
      state=state.copyWith(pending:next,
        messages:messages.values.toList()..sort((a,b)=>b.sequence.compareTo(a.sequence)),
        clearError:true);
    }catch(e) {
      if(!_closed)state=state.copyWith(error:'Message not confirmed. Retry the same message. ${_error(e)}');
    }finally{_inFlight.remove(clientMessageId);}
  }
  Future<void> edit(HumanDmMessage m,String text) async {
    if(_closed||!isAccountCurrent())return;
    try{
      final edited=await transport.edit(conversationId,m.messageId,text);
      if(_closed||!isAccountCurrent())return;
      state=state.copyWith(messages:[for(final row in state.messages)if(row.messageId==edited.messageId)edited else row],clearError:true);
    }catch(e){if(!_closed&&isAccountCurrent())state=state.copyWith(error:_error(e));}
  }
  Future<void> remove(HumanDmMessage m) async {
    if(_closed||!isAccountCurrent())return;
    try{
      final deleted=await transport.remove(conversationId,m.messageId);
      if(_closed||!isAccountCurrent())return;
      state=state.copyWith(messages:[for(final row in state.messages)if(row.messageId==deleted.messageId)deleted else row],clearError:true);
    }catch(e){if(!_closed&&isAccountCurrent())state=state.copyWith(error:_error(e));}
  }
  @override
  void dispose() { _closed=true;super.dispose(); }
}

final humanDmTransportProvider=Provider<HumanDmTransport>((ref)=>
  GatewayHumanDmTransport(ref.watch(apiClientProvider)));
final humanDmOutboxProvider=Provider<HumanDmOutbox>((ref)=>
  const SecureHumanDmOutbox());
typedef HumanDmKey=({String userId,String conversationId});
final humanDmThreadProvider=StateNotifierProvider.autoDispose.family<HumanDmController,HumanDmState,HumanDmKey>((ref,key)=>
  HumanDmController(key.userId,key.conversationId,
    ref.watch(humanDmTransportProvider),ref.watch(humanDmOutboxProvider),
    isAccountCurrent:(){
      final session=ref.read(sessionProvider);
      return session is SessionSignedIn && session.user.id==key.userId;
    }));

