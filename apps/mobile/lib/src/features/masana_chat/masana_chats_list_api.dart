import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class MasanaInboxItem {
  const MasanaInboxItem({
    required this.characterId,
    required this.displayName,
    required this.profession,
    required this.lastMessage,
    required this.lastActivityAt,
    required this.pinned,
    required this.unreadCount,
    required this.revision,
  });
  final String characterId, displayName, profession, lastMessage, lastActivityAt;
  final bool pinned;
  final int unreadCount, revision;

  factory MasanaInboxItem.fromJson(Map<String, dynamic> v) {
    final id=v['characterId'], name=v['displayName'], job=v['profession'];
    final revision=v['revision'], unread=v['unreadCount'];
    if (id is! String || !id.startsWith('character_') ||
        name is! String || job is! String ||
        revision is! int || revision<0 ||
        unread is! int || unread<0 || v['pinned'] is! bool) {
      throw const FormatException('Invalid Masana inbox projection');
    }
    return MasanaInboxItem(
      characterId:id, displayName:name, profession:job,
      lastMessage:v['lastMessage'] is String ? v['lastMessage'] as String : '',
      lastActivityAt:v['lastActivityAt'] is String
          ? v['lastActivityAt'] as String : '',
      pinned:v['pinned'] as bool, unreadCount:unread, revision:revision);
  }
  Map<String, dynamic> toJson() => {
    'characterId':characterId, 'displayName':displayName,
    'profession':profession, 'lastMessage':lastMessage,
    'lastActivityAt':lastActivityAt, 'pinned':pinned,
    'unreadCount':unreadCount, 'revision':revision,
  };
  MasanaInboxItem pinnedCopy(bool next, int version) => MasanaInboxItem(
    characterId:characterId,displayName:displayName,profession:profession,
    lastMessage:lastMessage,lastActivityAt:lastActivityAt,pinned:next,
    unreadCount:unreadCount,revision:version);
}

abstract class MasanaInboxAccess {
  Future<List<MasanaInboxItem>> load(String accountId, {String query = ''});
  Future<List<MasanaInboxItem>> readCache(String accountId);
  Future<int> pin(String characterId,bool pinned,int expectedRevision);
  Future<void> markRead(String characterId);
}

class MasanaChatsListApi implements MasanaInboxAccess {
  const MasanaChatsListApi(this.dio,this.storage);
  final Dio dio;
  final FlutterSecureStorage storage;
  String _cacheKey(String accountId) => 'masana.c10.inbox.v1:$accountId';

  @override
  Future<List<MasanaInboxItem>> readCache(String accountId) async {
    try {
      final raw=await storage.read(key:_cacheKey(accountId));
      if(raw==null) return [];
      final decoded=jsonDecode(raw);
      if(decoded is! List) return [];
      return decoded.whereType<Map>().take(50).map((v)=>
        MasanaInboxItem.fromJson(Map<String,dynamic>.from(v))).toList();
    } catch (_) {
      // A stale or corrupted cache must never make a private read succeed.
      return [];
    }
  }
  @override
  Future<List<MasanaInboxItem>> load(String accountId, {String query=''}) async {
    final response=await dio.get<Map<String,dynamic>>('/v1/chats',
      queryParameters:{if(query.isNotEmpty)'q':query});
    final data=response.data?['chats'];
    if(data is! List) throw const FormatException('Invalid chats response');
    final items=data.whereType<Map>().take(50).map((v)=>
      MasanaInboxItem.fromJson(Map<String,dynamic>.from(v))).toList();
    // Never let a partial search result overwrite the offline full-list cache.
    if(query.isEmpty) {
      await storage.write(key:_cacheKey(accountId),
        value:jsonEncode(items.map((v)=>v.toJson()).toList()));
    }
    return items;
  }
  @override
  Future<int> pin(String id,bool pinned,int expectedRevision) async {
    final result=await dio.patch<Map<String,dynamic>>(
      '/v1/chats/' + Uri.encodeComponent(id),
      data:{'pinned':pinned,'expectedRevision':expectedRevision});
    final revision=result.data?['revision'];
    if(revision is! int) throw const FormatException('Invalid pin revision');
    return revision;
  }
  @override
  Future<void> markRead(String id) async {
    await dio.post<void>(
      '/v1/chats/' + Uri.encodeComponent(id) + '/read');
  }
}
