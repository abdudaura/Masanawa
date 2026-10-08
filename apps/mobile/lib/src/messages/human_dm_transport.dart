import 'package:dio/dio.dart';

import '../core/network/api_client.dart';

/// Human DMs are distinct from AI chat history and public Talk messages.
class HumanDmMessage {
  const HumanDmMessage({
    required this.conversationId, required this.messageId, required this.sequence,
    required this.clientMessageId, required this.senderUserId, required this.text,
    required this.createdAt, required this.editedAt, required this.deletedAt,
  });
  factory HumanDmMessage.fromJson(dynamic raw) {
    final j = _object(raw);
    return HumanDmMessage(
      conversationId: _string(j, 'conversationId'),
      messageId: _string(j, 'messageId'),
      sequence: _integer(j, 'sequence'),
      clientMessageId: _string(j, 'clientRequestId'),
      senderUserId: _string(j, 'senderUserId'),
      text: j['body'] is String ? j['body'] as String : null,
      createdAt: DateTime.parse(_string(j, 'createdAt')).toUtc(),
      editedAt: j['editedAt'] is String ? DateTime.parse(j['editedAt'] as String).toUtc() : null,
      deletedAt: j['deletedAt'] is String ? DateTime.parse(j['deletedAt'] as String).toUtc() : null,
    );
  }
  final String conversationId, messageId, clientMessageId, senderUserId;
  final int sequence;
  final String? text;
  final DateTime createdAt;
  final DateTime? editedAt, deletedAt;
}
class HumanDmThread {
  const HumanDmThread({
    required this.conversationId,required this.otherUserId,required this.otherDisplayName,
    required this.otherHandle,required this.lastSequence,required this.lastActivityAt,
    required this.lastReadSequence,required this.unreadCount,
  });
  factory HumanDmThread.fromJson(dynamic raw) {
    final j = _object(raw);
    return HumanDmThread(
      conversationId:_string(j,'conversationId'),
      otherUserId:_string(j,'otherUserId'),
      otherDisplayName:_string(j,'otherDisplayName'),
      otherHandle:j['otherHandle'] is String ? j['otherHandle'] as String : null,
      lastSequence:_integer(j,'lastSequence'),
      lastActivityAt:DateTime.parse(_string(j,'updatedAt')).toUtc(),
      lastReadSequence:_integer(j,'lastReadSequence'),
      unreadCount:_integer(j,'unreadCount'),
    );
  }
  final String conversationId,otherUserId,otherDisplayName;
  final String? otherHandle;
  final int lastSequence,lastReadSequence,unreadCount;
  final DateTime lastActivityAt;
}
Map<String,dynamic> _object(dynamic raw) {
  if (raw is! Map) throw const FormatException('Unexpected messages response');
  return Map<String,dynamic>.from(raw);
}
String _string(Map<String,dynamic> j,String key) {
  final raw=j[key];
  if(raw is! String || raw.isEmpty) throw FormatException('Invalid messages $key');
  return raw;
}
int _integer(Map<String,dynamic> j,String key) {
  final raw=j[key];
  final value = raw is int ? raw : raw is String && RegExp(r'^(0|[1-9][0-9]*)$').hasMatch(raw) ? int.tryParse(raw) : null;
  if(value == null || value < 0) throw FormatException('Invalid messages $key');
  return value;
}
class HumanDmPage {
  const HumanDmPage(this.messages,this.nextBeforeSequence);
  final List<HumanDmMessage> messages;
  final int? nextBeforeSequence;
}
abstract interface class HumanDmTransport {
  Future<String> open(String otherUserId);
  Future<List<HumanDmThread>> inbox({int limit=40});
  Future<HumanDmPage> history(String conversationId,{int limit=40,int? beforeSequence});
  Future<HumanDmMessage> send(String conversationId,{required String clientMessageId,required String text});
  Future<int> read(String conversationId,int upToSequence);
  Future<HumanDmMessage> edit(String conversationId,String messageId,String text);
  Future<HumanDmMessage> remove(String conversationId,String messageId);
}
/// ApiClient owns bearer attachment and refresh; this transport never accepts
/// a second developer token or a caller-controlled user/tenant header.
class GatewayHumanDmTransport implements HumanDmTransport {
  GatewayHumanDmTransport(this.api);
  final ApiClient api;
  Future<Map<String,dynamic>> _request(String method,String path,{Map<String,dynamic>? json,Map<String,dynamic>? query}) async {
    try {
      final result=await api.dio.request<dynamic>(path,options:Options(method:method),
        data:json,queryParameters:query);
      return _object(result.data);
    } on DioException catch (error) {
      final status=error.response?.statusCode;
      final data=error.response?.data;
      String? code;
      if(data is Map && data['error'] is Map) {
        final found=(data['error'] as Map)['code'];
        if(found is String) code=found;
      }
      throw ApiException(switch(status) {
        401 => 'Your session has expired. Please sign in again.',
        403 => 'You cannot send messages to this person right now.',
        404 => 'This conversation is unavailable.',
        409 => 'This message changed during retry. Please review it.',
        429 => 'You are sending too quickly. Try again shortly.',
        _ => 'Could not contact Masanawa. Check your connection and retry.',
      },statusCode:status,code:code);
    }
  }
  String _path(String id) => '/messages/${Uri.encodeComponent(id)}';
  @override
  Future<String> open(String otherUserId) async {
    final j=await _request('POST','/messages',json:{'otherUserId':otherUserId});
    return _string(j,'conversationId');
  }
  @override
  Future<List<HumanDmThread>> inbox({int limit=40}) async {
    final j=await _request('GET','/messages',query:{'limit':limit});
    final rows=j['conversations'];
    if(rows is! List) throw const FormatException('Invalid conversation list');
    return List.unmodifiable(rows.map(HumanDmThread.fromJson));
  }
  @override
  Future<HumanDmPage> history(String conversationId,{int limit=40,int? beforeSequence}) async {
    final j=await _request('GET',_path(conversationId),
      query:{'limit':limit,if(beforeSequence!=null)'before':beforeSequence.toString()});
    final rows=j['messages'];
    if(rows is! List) throw const FormatException('Invalid message history');
    final before=j['nextBefore'];
    final cursor = before == null ? null : _integer({'cursor':before},'cursor');
    return HumanDmPage(List.unmodifiable(rows.map(HumanDmMessage.fromJson)),cursor);
  }
  @override
  Future<HumanDmMessage> send(String conversationId,{required String clientMessageId,required String text}) async =>
      HumanDmMessage.fromJson(await _request('POST',_path(conversationId),
        json:{'clientRequestId':clientMessageId,'body':text}));
  @override
  Future<int> read(String conversationId,int upToSequence) async =>
      _integer(await _request('PUT','${_path(conversationId)}/read',
        json:{'throughSequence':upToSequence.toString()}),'lastReadSequence');
  @override
  Future<HumanDmMessage> edit(String conversationId,String messageId,String text) async =>
      HumanDmMessage.fromJson(await _request('PATCH','/messages/items/${Uri.encodeComponent(messageId)}',
        json:{'body':text}));
  @override
  Future<HumanDmMessage> remove(String conversationId,String messageId) async =>
      HumanDmMessage.fromJson(await _request('DELETE','/messages/items/${Uri.encodeComponent(messageId)}'));
}

