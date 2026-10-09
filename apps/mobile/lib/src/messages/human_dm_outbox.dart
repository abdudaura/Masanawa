import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Encrypted pending text ONLY. C05 owns the later indexed history/media cache.
/// Keys include canonical account + conversation; never shared across users.
class HumanDmPending {
  const HumanDmPending(this.id,this.text,this.createdAt);
  final String id, text;
  final DateTime createdAt;
  Map<String,dynamic> toJson()=>{'id':id,'text':text,'createdAt':createdAt.toUtc().toIso8601String()};
  factory HumanDmPending.fromJson(dynamic raw) {
    if(raw is! Map) throw const FormatException('Invalid pending message');
    final j=Map<String,dynamic>.from(raw);
    if(j['id'] is! String || j['text'] is! String || j['createdAt'] is! String) {
      throw const FormatException('Invalid pending message');
    }
    return HumanDmPending(j['id'] as String,j['text'] as String,DateTime.parse(j['createdAt'] as String));
  }
}
abstract interface class HumanDmOutbox {
  Future<List<HumanDmPending>> load(String userId,String conversationId);
  Future<void> save(String userId,String conversationId,List<HumanDmPending> pending);
  Future<void> clear(String userId,String conversationId);
}
class SecureHumanDmOutbox implements HumanDmOutbox {
  const SecureHumanDmOutbox({this.storage=const FlutterSecureStorage(
    aOptions:AndroidOptions(),iOptions:IOSOptions(accessibility:KeychainAccessibility.first_unlock_this_device))});
  final FlutterSecureStorage storage;
  String _key(String user,String conversation) {
    // IDs are both canonical server or UUID identifiers, not arbitrary labels.
    return 'human_dm_pending_v1_${Uri.encodeComponent(user)}_${Uri.encodeComponent(conversation)}';
  }
  @override
  Future<List<HumanDmPending>> load(String userId,String conversationId) async {
    final raw=await storage.read(key:_key(userId,conversationId));
    if(raw==null) return [];
    try {
      final data=jsonDecode(raw);
      if(data is! List || data.length>50) throw const FormatException('Invalid outbox');
      return List.unmodifiable(data.map(HumanDmPending.fromJson));
    } catch (_) {
      // Corrupt encrypted local state must never fabricate a successfully sent DM.
      await clear(userId,conversationId);
      return [];
    }
  }
  @override
  Future<void> save(String userId,String conversationId,List<HumanDmPending> pending) async {
    if(pending.length>50 || pending.any((p)=>p.text.length>4096)) {
      throw StateError('Pending message limit reached');
    }
    if(pending.isEmpty) { await clear(userId,conversationId); return; }
    await storage.write(key:_key(userId,conversationId),value:jsonEncode(pending.map((e)=>e.toJson()).toList()));
  }
  @override
  Future<void> clear(String userId,String conversationId) =>
      storage.delete(key:_key(userId,conversationId));
}
