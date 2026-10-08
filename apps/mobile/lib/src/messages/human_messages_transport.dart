import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

Map<String, dynamic> _object(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  throw const FormatException('Invalid human messaging response');
}
String _string(dynamic value) {
  if (value is! String || value.isEmpty) {
    throw const FormatException('Missing human messaging field');
  }
  return value;
}
DateTime _date(dynamic value) {
  if (value is! String) throw const FormatException('Invalid message timestamp');
  final parsed = DateTime.tryParse(value);
  if (parsed == null) throw const FormatException('Invalid message timestamp');
  return parsed.toUtc();
}

/// Messages are solely person-to-person, never a Gwani/Gwana or Twin session.
class HumanMessageDto {
  HumanMessageDto._({
    required this.conversationId,required this.messageId,required this.senderUserId,
    required this.text,required this.createdAt,required this.editedAt,
    required this.deletedAt,required this.revision,
  });
  final String conversationId, messageId, senderUserId, text;
  final DateTime createdAt;
  final DateTime? editedAt, deletedAt;
  final int revision;
  bool get deleted => deletedAt != null;

  factory HumanMessageDto.fromJson(Map<String, dynamic> json) {
    final revision = json['revision'];
    if (revision is! int || revision < 1 || json['text'] is! String ||
        (json['editedAt'] != null && json['editedAt'] is! String) ||
        (json['deletedAt'] != null && json['deletedAt'] is! String)) {
      throw const FormatException('Invalid human message');
    }
    final text = json['text'] as String;
    if (text.length > 4000 || (json['deletedAt'] != null && text.isNotEmpty)) {
      throw const FormatException('Invalid human message state');
    }
    return HumanMessageDto._(
      conversationId:_string(json['conversationId']),
      messageId:_string(json['messageId']),
      senderUserId:_string(json['senderUserId']),
      text:text,createdAt:_date(json['createdAt']),
      editedAt:json['editedAt'] == null ? null : _date(json['editedAt']),
      deletedAt:json['deletedAt'] == null ? null : _date(json['deletedAt']),
      revision:revision,
    );
  }
}
class HumanConversationDto {
  HumanConversationDto._({
    required this.conversationId,required this.otherUserId,
    required this.createdAt,required this.updatedAt,required this.lastMessage,
  });
  final String conversationId, otherUserId;
  final DateTime createdAt,updatedAt;
  final HumanMessageDto? lastMessage;
  factory HumanConversationDto.fromJson(Map<String,dynamic> json) {
    return HumanConversationDto._(
      conversationId:_string(json['conversationId']),
      otherUserId:_string(json['otherUserId']),
      createdAt:_date(json['createdAt']),
      updatedAt:_date(json['updatedAt']),
      lastMessage:json['lastMessage']==null? null
        :HumanMessageDto.fromJson(_object(json['lastMessage'])),
    );
  }
}
class HumanMessagePageDto {
  HumanMessagePageDto({required this.messages,required this.nextCursor});
  final List<HumanMessageDto> messages;
  final String? nextCursor;
  factory HumanMessagePageDto.fromJson(Map<String,dynamic> json) {
    final raw = json['messages'];
    if (raw is! List || (json['nextCursor'] != null && json['nextCursor'] is! String)) {
      throw const FormatException('Invalid message history');
    }
    return HumanMessagePageDto(
      messages:List.unmodifiable(raw.map((m)=>HumanMessageDto.fromJson(_object(m)))),
      nextCursor:json['nextCursor'] as String?,
    );
  }
}
abstract interface class HumanMessagesTransport {
  Future<HumanConversationDto> start({required String recipientUserId});
  Future<List<HumanConversationDto>> list({int limit});
  Future<HumanConversationDto> read({required String conversationId});
  Future<HumanMessagePageDto> history({required String conversationId,int limit,String? before});
  Future<HumanMessageDto> send({required String conversationId,required String requestId,required String text});
  Future<HumanMessageDto> edit({required String conversationId,required String messageId,required int expectedRevision,required String text});
  Future<HumanMessageDto> delete({required String conversationId,required String messageId,required int expectedRevision});
}
class GatewayHumanMessagesTransport implements HumanMessagesTransport {
  GatewayHumanMessagesTransport(this.api);
  final ApiClient api;
  String _path(String conversationId) => '/messages/conversations/${Uri.encodeComponent(conversationId)}';
  Future<Map<String,dynamic>> _get(String url,{Map<String,dynamic>? query}) async {
    final response=await api.dio.get<dynamic>(url,queryParameters:query);
    return _object(response.data);
  }
  @override
  Future<HumanConversationDto> start({required String recipientUserId}) async {
    final response=await api.dio.post<dynamic>('/messages/conversations',
      data:{'recipientUserId':recipientUserId});
    return HumanConversationDto.fromJson(_object(response.data));
  }
  @override
  Future<List<HumanConversationDto>> list({int limit=30}) async {
    final json=await _get('/messages/conversations',query:{'limit':limit});
    final items=json['conversations'];
    if (items is! List) throw const FormatException('Invalid human inbox');
    return List.unmodifiable(items.map((v)=>HumanConversationDto.fromJson(_object(v))));
  }
  @override
  Future<HumanConversationDto> read({required String conversationId}) async =>
    HumanConversationDto.fromJson(await _get(_path(conversationId)));
  @override
  Future<HumanMessagePageDto> history({required String conversationId,int limit=30,String? before}) async =>
    HumanMessagePageDto.fromJson(await _get('${_path(conversationId)}/messages',
      query:{'limit':limit,if(before!=null)'before':before}));
  @override
  Future<HumanMessageDto> send({required String conversationId,required String requestId,required String text}) async {
    final response=await api.dio.post<dynamic>('${_path(conversationId)}/messages',
      data:{'requestId':requestId,'text':text});
    return HumanMessageDto.fromJson(_object(response.data));
  }
  @override
  Future<HumanMessageDto> edit({required String conversationId,required String messageId,required int expectedRevision,required String text}) async {
    final response=await api.dio.patch<dynamic>('${_path(conversationId)}/messages/${Uri.encodeComponent(messageId)}',
      data:{'text':text,'expectedRevision':expectedRevision});
    return HumanMessageDto.fromJson(_object(response.data));
  }
  @override
  Future<HumanMessageDto> delete({required String conversationId,required String messageId,required int expectedRevision}) async {
    final response=await api.dio.delete<dynamic>('${_path(conversationId)}/messages/${Uri.encodeComponent(messageId)}',
      queryParameters:{'expectedRevision':expectedRevision});
    return HumanMessageDto.fromJson(_object(response.data));
  }
}
