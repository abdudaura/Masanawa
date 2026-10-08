import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'human_messages_transport.dart';

class HumanPendingSend {
  const HumanPendingSend(this.requestId,this.text);
  final String requestId,text;
  factory HumanPendingSend.fromJson(String raw) {
    final json=jsonDecode(raw);
    if (json is! Map || json['requestId'] is! String ||
        json['text'] is! String || (json['requestId'] as String).length<8 ||
        (json['requestId'] as String).length>128 || (json['text'] as String).trim().isEmpty ||
        (json['text'] as String).length>4000) {
      throw const FormatException('Invalid private message recovery state');
    }
    return HumanPendingSend(json['requestId'] as String,json['text'] as String);
  }
  String toJson()=>jsonEncode({'requestId':requestId,'text':text});
}
abstract interface class HumanMessagePendingStore {
  Future<HumanPendingSend?> read({required String userId,required String conversationId});
  Future<void> write({required String userId,required String conversationId,required HumanPendingSend value});
  Future<void> clear({required String userId,required String conversationId});
}
class SecureHumanMessagePendingStore implements HumanMessagePendingStore {
  SecureHumanMessagePendingStore({FlutterSecureStorage? storage})
    :_storage=storage??const FlutterSecureStorage(
      aOptions:AndroidOptions(),
      iOptions:IOSOptions(accessibility:KeychainAccessibility.first_unlock_this_device));
  final FlutterSecureStorage _storage;
  String _key(String userId,String conversationId) {
    if(userId.isEmpty||conversationId.isEmpty)throw StateError('Authenticated message scope required');
    return 'human_dm_pending_v1_${base64Url.encode(utf8.encode(userId))}_${base64Url.encode(utf8.encode(conversationId))}';
  }
  @override
  Future<HumanPendingSend?> read({required String userId,required String conversationId}) async {
    final raw=await _storage.read(key:_key(userId,conversationId));
    return raw==null?null:HumanPendingSend.fromJson(raw);
  }
  @override
  Future<void> write({required String userId,required String conversationId,required HumanPendingSend value}) =>
    _storage.write(key:_key(userId,conversationId),value:value.toJson());
  @override
  Future<void> clear({required String userId,required String conversationId}) =>
    _storage.delete(key:_key(userId,conversationId));
}

/// Scoped C02 text-only presentation state. C03/C05 own the richer multi-
/// message offline outbox, push/delta, and protected indexed history cache.
class HumanConversationController extends ChangeNotifier {
  HumanConversationController({
    required this.ownerUserId,
    required this.conversationId,
    required this.transport,
    required this.pendingStore,
    required this.activeUserId,
  });
  final String ownerUserId,conversationId;
  final HumanMessagesTransport transport;
  final HumanMessagePendingStore pendingStore;
  final String? Function() activeUserId;
  final Random _random=Random.secure();
  bool loading=false,sending=false,loadingOlder=false;
  String? error;
  String? nextCursor;
  HumanPendingSend? pending;
  List<HumanMessageDto> messages=[];
  bool _disposed=false;
  int _generation=0;
  void _checkOwner() {
    if(ownerUserId.isEmpty||conversationId.isEmpty||activeUserId()!=ownerUserId||_disposed) {
      throw StateError('Sign in to the original account to continue messaging');
    }
  }
  void _update() {if(!_disposed)notifyListeners();}
  void _merge(Iterable<HumanMessageDto> items) {
    final map={for(final m in messages)m.messageId:m};
    for(final m in items) {
      if(m.conversationId!=conversationId) throw const FormatException('Wrong conversation response');
      map[m.messageId]=m;
    }
    messages=List.unmodifiable(map.values.toList()..sort((a,b) {
      final t=b.createdAt.compareTo(a.createdAt);
      return t==0?b.messageId.compareTo(a.messageId):t;
    }));
  }
  Future<void> open() async {
    _checkOwner();
    final generation=++_generation;
    loading=true;error=null;_update();
    try {
      // Fail closed if encrypted account recovery cannot be read.
      final stored=await pendingStore.read(userId:ownerUserId,conversationId:conversationId);
      _checkOwner();
      final page=await transport.history(conversationId:conversationId);
      _checkOwner();
      if(generation!=_generation)return;
      pending=stored;
      messages=List.unmodifiable(page.messages);
      nextCursor=page.nextCursor;
    } catch (_) {
      if(generation==_generation)error='Unable to load this conversation. Retry when connected.';
    } finally {
      if(generation==_generation){loading=false;_update();}
    }
  }
  Future<void> older() async {
    _checkOwner();
    final cursor=nextCursor;
    if(cursor==null||loadingOlder)return;
    loadingOlder=true;_update();
    try {
      final page=await transport.history(conversationId:conversationId,before:cursor);
      _checkOwner();
      _merge(page.messages);
      nextCursor=page.nextCursor;
      error=null;
    }catch(_) {
      error='Could not load older messages.';
    }finally{loadingOlder=false;_update();}
  }
  String _newRequestId() {
    final now=DateTime.now().microsecondsSinceEpoch;
    return 'dm-$now-${_random.nextInt(0x100000000)}-${_random.nextInt(0x100000000)}';
  }
  Future<bool> send(String text) async {
    _checkOwner();
    if(sending)return false;
    if(text.trim().isEmpty||text.length>4000) {
      error='Enter a message up to 4000 characters.';_update();return false;
    }
    sending=true;error=null;_update();
    try {
      var current=await pendingStore.read(userId:ownerUserId,conversationId:conversationId);
      _checkOwner();
      if(current!=null&&current.text!=text){
        error='An earlier message has an uncertain outcome. Retry it before composing another.';
        return false;
      }
      current??=HumanPendingSend(_newRequestId(),text);
      if(pending==null) {
        // A write failure must never issue a duplicate HTTP send.
        await pendingStore.write(userId:ownerUserId,conversationId:conversationId,value:current);
      }
      pending=current;_checkOwner();_update();
      final result=await transport.send(conversationId:conversationId,requestId:current.requestId,text:current.text);
      _checkOwner();
      if(result.senderUserId!=ownerUserId||result.conversationId!=conversationId||
          result.text!=current.text||result.deleted){
        throw const FormatException('The server did not confirm this message');
      }
      _merge([result]);
      await pendingStore.clear(userId:ownerUserId,conversationId:conversationId);
      _checkOwner();
      pending=null;
      return true;
    }catch(_) {
      error='Delivery not confirmed. Retry the same pending message when connected.';
      return false;
    }finally{sending=false;_update();}
  }
  Future<bool> retryPending() async {
    _checkOwner();
    final record=await pendingStore.read(userId:ownerUserId,conversationId:conversationId);
    _checkOwner();
    if(record==null)return false;
    pending=record;
    return send(record.text);
  }
  Future<void> edit(HumanMessageDto original,String text) async {
    _checkOwner();
    if(original.senderUserId!=ownerUserId||original.deleted)throw StateError('Only your own messages can be edited');
    final result=await transport.edit(conversationId:conversationId,messageId:original.messageId,
      expectedRevision:original.revision,text:text);
    _checkOwner();
    if(result.messageId!=original.messageId||result.conversationId!=conversationId||result.revision<=original.revision) {
      throw const FormatException('Edit receipt did not match the message');
    }
    _merge([result]);_update();
  }
  Future<void> delete(HumanMessageDto original) async {
    _checkOwner();
    if(original.senderUserId!=ownerUserId)throw StateError('Only your own messages can be deleted');
    final result=await transport.delete(conversationId:conversationId,
      messageId:original.messageId,expectedRevision:original.revision);
    _checkOwner();
    if(result.messageId!=original.messageId||!result.deleted||result.conversationId!=conversationId) {
      throw const FormatException('Delete receipt did not match the message');
    }
    _merge([result]);_update();
  }
  @override
  void dispose(){_disposed=true;_generation++;super.dispose();}
}
